package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.ModuleDiscoveryAgent.DiscoveryResult;
import com.enterprise.itmapping.feature.changedetection.application.DetectedChangeDrafts;
import com.enterprise.itmapping.feature.changedetection.application.DetectedChangeDrafts.ProposedModule;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload.AiModuleEntry;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload.AiRelationshipEntry;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse.CreatedItem;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse.SkippedItem;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubRepoCloneService;
import com.enterprise.itmapping.feature.integrations.llm.ModuleDiscoveryProperties;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Clones the GitHub repository of an application, runs a Spring AI agent (ReAct + grep/read/list
 * tools) to discover business modules, validates the JSON contract, and persists the {@code Module}
 * subgraph as {@code CONTAINS} rooted at the {@link com.enterprise.itmapping.domain.Application}.
 *
 * <p><strong>Edge strategy:</strong> only {@code structural_contains} from the agent is materialized
 * as Neo4j {@code CONTAINS}; other kinds are ignored.
 *
 * <p><strong>Idempotence:</strong> if the application already has at least one {@code Module}
 * reachable via outbound {@code CONTAINS}, returns {@code 409 Conflict} without cloning or calling
 * the LLM (retry allowed once the subtree is empty).
 */
@Service
public class ModuleSuggestionService {

  private static final Logger log = LoggerFactory.getLogger(ModuleSuggestionService.class);

  private static final java.util.regex.Pattern SLUG_PATTERN =
      java.util.regex.Pattern.compile("[a-z][a-z0-9_.-]{1,127}");

  private final ApplicationRepository applicationRepository;
  private final GitHubRepoCloneService cloneService;
  private final ModuleDiscoveryAgent moduleDiscoveryAgent;
  private final ModuleDiscoveryProperties properties;
  private final Neo4jClient neo4jClient;
  private final ObjectProvider<ModuleSuggestionService> self;
  private final ApplicationModuleSubtreeQuery moduleSubtreeQuery;
  private final AiDecisionSourceService decisionSources;
  private final ApplicationDetectionDocumentService documentService;
  private final ApplicationModuleLifecycle moduleLifecycle;

  public ModuleSuggestionService(
      ApplicationRepository applicationRepository,
      GitHubRepoCloneService cloneService,
      ModuleDiscoveryAgent moduleDiscoveryAgent,
      ModuleDiscoveryProperties properties,
      Neo4jClient neo4jClient,
      ObjectProvider<ModuleSuggestionService> self,
      ApplicationModuleSubtreeQuery moduleSubtreeQuery,
      AiDecisionSourceService decisionSources,
      ApplicationDetectionDocumentService documentService,
      ApplicationModuleLifecycle moduleLifecycle) {
    this.applicationRepository = applicationRepository;
    this.cloneService = cloneService;
    this.moduleDiscoveryAgent = moduleDiscoveryAgent;
    this.properties = properties;
    this.neo4jClient = neo4jClient;
    this.self = self;
    this.moduleSubtreeQuery = moduleSubtreeQuery;
    this.decisionSources = decisionSources;
    this.documentService = documentService;
    this.moduleLifecycle = moduleLifecycle;
  }

  public SuggestModulesFromGithubResponse suggestFromGithub(
      String applicationId, SuggestModulesFromGithubRequest request) {
    return self.getObject().suggestFromGithubTransactional(applicationId, request);
  }

  @Transactional
  protected SuggestModulesFromGithubResponse suggestFromGithubTransactional(
      String applicationId, SuggestModulesFromGithubRequest request) {

    var appRow =
        applicationRepository
            .findProjectionById(applicationId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Application introuvable: " + applicationId));

    if (moduleSubtreeQuery.hasAnyModuleViaContains(applicationId)) {
      if (request == null || !Boolean.TRUE.equals(request.replaceExisting())) {
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "Les modules ont déjà été suggérés pour cette application.");
      }
      moduleLifecycle.removeAll(applicationId);
    }

    List<String> bitbucketNames =
        BitbucketRepoIdentityResolver.resolveAllFullNames(appRow.getName(), appRow.getDescription());
    List<String> githubNames =
        GithubRepoIdentityResolver.resolveAllFullNames(appRow.getName(), appRow.getDescription());
    if (!bitbucketNames.isEmpty() && !githubNames.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "An application cannot mix GitHub and Bitbucket repositories.");
    }
    boolean bitbucket = !bitbucketNames.isEmpty();
    List<String> fullNames = bitbucket ? bitbucketNames : githubNames;
    if (fullNames.isEmpty()
        && request != null
        && request.fullName() != null
        && !request.fullName().isBlank()) {
      fullNames =
          List.of(
              GithubRepoIdentityResolver.resolveFullName(
                      appRow.getName(), appRow.getDescription(), request.fullName())
                  .orElseThrow(
                      () ->
                          new ResponseStatusException(
                              HttpStatus.BAD_REQUEST, "fullName doit etre owner/repo.")));
    }
    if (fullNames.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Depot introuvable pour cette application: renseignez une URL GitHub ou Bitbucket "
              + "dans la description, ou fullName dans le corps.");
    }

    log.info("Module suggestion start applicationId={} repos={}", applicationId, fullNames);

    Path workspace;
    DiscoveryResult discovery;
    if (fullNames.size() == 1) {
      String[] parts = ownerAndRepo(fullNames.get(0));
      workspace =
          bitbucket
              ? cloneService.clone(parts[0], parts[1], properties.cloneTimeoutSeconds(), true)
              : cloneService.clone(parts[0], parts[1], properties.cloneTimeoutSeconds());
      discovery = moduleDiscoveryAgent.discover(workspace, parts[0], parts[1]);
    } else {
      workspace =
          bitbucket
              ? cloneService.cloneAll(
                  fullNames, properties.cloneTimeoutSeconds(), cloneService.accessToken(true), true)
              : cloneService.cloneAll(fullNames, properties.cloneTimeoutSeconds());
      discovery = moduleDiscoveryAgent.discoverAll(workspace, fullNames);
    }
    try {
      return persist(applicationId, String.join(", ", fullNames), discovery, null);
    } finally {
      cloneService.deleteQuietly(workspace);
    }
  }

  public SuggestModulesFromGithubResponse suggestFromDocument(String applicationId) {
    return self.getObject().suggestFromDocumentTransactional(applicationId);
  }

  @Transactional
  protected SuggestModulesFromGithubResponse suggestFromDocumentTransactional(String applicationId) {
    var appRow =
        applicationRepository
            .findProjectionById(applicationId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Application introuvable: " + applicationId));
    if (GithubRepoIdentityResolver.resolveFullName(appRow.getName(), appRow.getDescription(), null)
        .isPresent()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "This application is linked to GitHub.");
    }
    if (!BitbucketRepoIdentityResolver.resolveAllFullNames(appRow.getName(), appRow.getDescription())
        .isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "This application is linked to Bitbucket.");
    }
    if (moduleSubtreeQuery.hasAnyModuleViaContains(applicationId)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Les modules ont déjà été suggérés pour cette application.");
    }
    ApplicationDetectionDocumentService.StoredDocument document = documentService.require(applicationId);
    String sourceName = StringUtils.hasText(appRow.getName()) ? appRow.getName() : applicationId;
    DiscoveryResult discovery =
        moduleDiscoveryAgent.discoverFromDocument(sourceName, document.title(), document.body());
    return persist(applicationId, document.title(), discovery, document.body());
  }

  private SuggestModulesFromGithubResponse persist(
      String applicationId, String repositoryName, DiscoveryResult discovery, String documentBody) {

    var payload = discovery.payload();
    List<CreatedItem> created = new ArrayList<>();
    List<SkippedItem> skipped = new ArrayList<>();

    Map<String, AiModuleEntry> acceptedBySlug = new LinkedHashMap<>();
    for (AiModuleEntry mod : payload.getModules()) {
      String slug = mod.getId();
      if (!isValidSlug(slug)) {
        skipped.add(new SkippedItem("module", "slug_ia_invalide", slug));
        continue;
      }
      if (!StringUtils.hasText(mod.getBusinessName())) {
        skipped.add(new SkippedItem("module", "business_name_manquant", slug));
        continue;
      }
      if (acceptedBySlug.containsKey(slug)) {
        String unique = uniqueModuleSlug(slug, mod.getSourceFiles(), acceptedBySlug.keySet());
        if (unique == null) {
          skipped.add(new SkippedItem("module", "doublon_slug_ia", slug));
          continue;
        }
        mod.setId(unique);
        slug = unique;
      }
      if (documentBody != null) {
        List<String> quotes = DocumentExcerpt.matching(documentBody, mod.getSourceFiles());
        if (quotes.isEmpty()) {
          skipped.add(new SkippedItem("module", "evidence_absente", slug));
          continue;
        }
        mod.setSourceFiles(quotes);
      }
      acceptedBySlug.put(slug, mod);
    }

    List<Rel> relsAccepted = new ArrayList<>();
    for (AiRelationshipEntry r : payload.getRelationships()) {
      if (!"structural_contains".equalsIgnoreCase(r.getRelationshipKind())) {
        skipped.add(
            new SkippedItem(
                "relationship",
                "kind_non_supporte_v1",
                r.getFromModuleId() + "->" + r.getToModuleId()));
        continue;
      }
      if (!StringUtils.hasText(r.getFromModuleId())
          || !StringUtils.hasText(r.getToModuleId())
          || r.getFromModuleId().equals(r.getToModuleId())) {
        skipped.add(new SkippedItem("relationship", "endpoints_invalides", String.valueOf(r)));
        continue;
      }
      if (!acceptedBySlug.containsKey(r.getFromModuleId())
          || !acceptedBySlug.containsKey(r.getToModuleId())) {
        skipped.add(
            new SkippedItem(
                "relationship",
                "module_slug_inconnu",
                r.getFromModuleId() + "->" + r.getToModuleId()));
        continue;
      }
      if (documentBody != null) {
        List<String> quotes = DocumentExcerpt.matching(documentBody, r.getSourceFiles());
        if (quotes.isEmpty()) {
          skipped.add(
              new SkippedItem(
                  "relationship",
                  "evidence_absente",
                  r.getFromModuleId() + "->" + r.getToModuleId()));
          continue;
        }
        r.setSourceFiles(quotes);
      }
      relsAccepted.add(new Rel(r.getFromModuleId(), r.getToModuleId(), r.getSourceFiles()));
    }

    if (hasCycle(relsAccepted)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Relations structural_contains cycliques : revisionnez la reponse IA.");
    }

    Set<String> children = new HashSet<>();
    for (Rel rel : relsAccepted) {
      children.add(rel.child());
    }

    Map<String, String> slugToNeoId = new LinkedHashMap<>();
    for (Map.Entry<String, AiModuleEntry> e : acceptedBySlug.entrySet()) {
      String neoId = UUID.randomUUID().toString();
      slugToNeoId.put(e.getKey(), neoId);
      String desc = e.getValue().getDescriptionMetierBreve();
      if (!StringUtils.hasText(desc)) {
        desc = "Module suggere (IA) — " + e.getKey();
      }

      Map<String, Object> params = new HashMap<>();
      params.put("id", neoId);
      params.put("name", e.getValue().getBusinessName());
      params.put("desc", desc);
      neo4jClient
          .query("CREATE (m:Module {id: $id, name: $name, description: $desc})")
          .bindAll(params)
          .run();
      moduleLifecycle.recordCreated(applicationId, neoId, e.getValue().getBusinessName());

      created.add(new CreatedItem(neoId, e.getKey(), e.getValue().getBusinessName()));
      trace(
          repositoryName,
          AiDecisionSourceService.KIND_NODE,
          AiDecisionSourceService.TARGET_MODULE,
          neoId,
          null,
          e.getValue().getSourceFiles(),
          discovery.observedFiles(),
          documentBody);
    }

    for (String slug : acceptedBySlug.keySet()) {
      if (!children.contains(slug)) {
        String moduleId = slugToNeoId.get(slug);
        linkApplicationContains(applicationId, moduleId);
        trace(
            repositoryName,
            AiDecisionSourceService.KIND_EDGE,
            AiDecisionSourceService.TARGET_EDGE,
            AiDecisionSourceService.containsTargetId(applicationId, moduleId),
            null,
            acceptedBySlug.get(slug).getSourceFiles(),
            discovery.observedFiles(),
            documentBody);
      }
    }

    for (Rel rel : relsAccepted) {
      String parentId = slugToNeoId.get(rel.parent());
      String childId = slugToNeoId.get(rel.child());
      linkModuleContains(parentId, childId);
      trace(
          repositoryName,
          AiDecisionSourceService.KIND_EDGE,
          AiDecisionSourceService.TARGET_EDGE,
          AiDecisionSourceService.containsTargetId(parentId, childId),
          null,
          rel.sourceFiles(),
          discovery.observedFiles(),
          documentBody);
    }

    log.info(
        "Module suggestion result applicationId={} created={} skipped={} modules={} relationships={} analyzedFiles={}",
        applicationId,
        created.size(),
        skipped.size(),
        created.stream().map(CreatedItem::slugId).toList(),
        relsAccepted.stream().map(r -> r.parent() + "->" + r.child()).toList(),
        discovery.analyzedFiles().size());
    for (SkippedItem item : skipped) {
      log.debug(
          "Module suggestion skipped scope={} reason={} detail={}",
          item.scope(),
          item.reason(),
          item.detail());
    }

    return new SuggestModulesFromGithubResponse(
        List.copyOf(created), List.copyOf(skipped), List.copyOf(discovery.analyzedFiles()));
  }

  /**
   * Reads a commit diff and returns modules it names. Nothing is written.
   */
  public List<ProposedModule> proposeFromDiff(String applicationId, String diffText) {
    if (!StringUtils.hasText(diffText)) {
      return List.of();
    }
    var appRow =
        applicationRepository
            .findProjectionById(applicationId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Application introuvable: " + applicationId));
    String sourceName = StringUtils.hasText(appRow.getName()) ? appRow.getName() : applicationId;
    DiscoveryResult discovery =
        moduleDiscoveryAgent.discoverFromDocument(sourceName, "commit diff", diffText);
    List<ProposedModule> proposed = new ArrayList<>();
    for (AiModuleEntry module : discovery.payload().getModules()) {
      if (!isValidSlug(module.getId()) || !StringUtils.hasText(module.getBusinessName())) {
        continue;
      }
      proposed.add(new ProposedModule(module.getId(), module.getBusinessName().trim()));
    }
    return List.copyOf(proposed);
  }

  /** Drops modules already linked to this application. Another application's module stays. */
  public List<ProposedModule> onlyNewModules(String applicationId, List<ProposedModule> proposed) {
    if (proposed == null || proposed.isEmpty()) {
      return List.of();
    }
    List<String> existingNames =
        neo4jClient
            .query(
                """
                MATCH (:Application {id: $id})-[:CONTAINS*1..50]->(m:Module)
                RETURN m.name AS name
                """)
            .bind(applicationId)
            .to("id")
            .fetch()
            .all()
            .stream()
            .map(row -> row.get("name"))
            .filter(Objects::nonNull)
            .map(String::valueOf)
            .toList();
    return DetectedChangeDrafts.withoutExistingModules(proposed, existingNames);
  }

  /** Creates one module already deduced from a diff. Does not clone or call the model again. */
  public void applyProposedModule(String applicationId, String slug, String businessName) {
    if (!isValidSlug(slug) || !StringUtils.hasText(businessName)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Module proposal is incomplete.");
    }
    String name = businessName.trim();
    Optional<Map<String, Object>> existing =
        neo4jClient
            .query(
                """
                MATCH (:Application {id: $id})-[:CONTAINS*1..50]->(m:Module)
                WHERE toLower(m.name) = toLower($name)
                RETURN m.id AS id
                LIMIT 1
                """)
            .bind(applicationId)
            .to("id")
            .bind(name)
            .to("name")
            .fetch()
            .one();
    if (existing.isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Module already exists: " + name);
    }
    String neoId = UUID.randomUUID().toString();
    Map<String, Object> params = new HashMap<>();
    params.put("id", neoId);
    params.put("name", name);
    params.put("desc", "Module detected from a commit diff.");
    neo4jClient
        .query("CREATE (m:Module {id: $id, name: $name, description: $desc})")
        .bindAll(params)
        .run();
    linkApplicationContains(applicationId, neoId);
    moduleLifecycle.recordCreated(applicationId, neoId, name);
  }

  private void linkApplicationContains(String applicationId, String moduleNeoId) {
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $appId})
            MATCH (m:Module {id: $mid})
            CREATE (a)-[:CONTAINS]->(m)
            """)
        .bind(applicationId)
        .to("appId")
        .bind(moduleNeoId)
        .to("mid")
        .run();
  }

  private void linkModuleContains(String parentNeoId, String childNeoId) {
    neo4jClient
        .query(
            """
            MATCH (p:Module {id: $pid})
            MATCH (c:Module {id: $cid})
            CREATE (p)-[:CONTAINS]->(c)
            """)
        .bind(parentNeoId)
        .to("pid")
        .bind(childNeoId)
        .to("cid")
        .run();
  }

  private static String[] ownerAndRepo(String fullName) {
    int slash = fullName.indexOf('/');
    if (slash <= 0 || slash == fullName.length() - 1) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fullName doit etre owner/repo.");
    }
    return new String[] {fullName.substring(0, slash), fullName.substring(slash + 1)};
  }

  static String uniqueModuleSlug(String slug, List<String> sourceFiles, Set<String> used) {
    if (!used.contains(slug)) {
      return slug;
    }
    String folder = folderSegment(sourceFiles);
    if (folder == null) {
      return null;
    }
    String prefixed = folder + "-" + slug;
    if (!isValidSlug(prefixed) || used.contains(prefixed)) {
      return null;
    }
    return prefixed;
  }

  private static String folderSegment(List<String> sourceFiles) {
    if (sourceFiles == null) {
      return null;
    }
    for (String path : sourceFiles) {
      if (path == null || path.isBlank()) {
        continue;
      }
      String normalized = path.replace('\\', '/').trim();
      int slash = normalized.indexOf('/');
      if (slash <= 0) {
        continue;
      }
      String folder = normalized.substring(0, slash).toLowerCase(Locale.ROOT);
      if (isValidSlug(folder)) {
        return folder;
      }
    }
    return null;
  }

  private static boolean isValidSlug(String slug) {
    return slug != null && SLUG_PATTERN.matcher(slug.toLowerCase(Locale.ROOT)).matches();
  }

  private static boolean hasCycle(List<Rel> edges) {
    Map<String, List<String>> adj = new HashMap<>();
    Set<String> nodes = new HashSet<>();
    for (Rel r : edges) {
      adj.computeIfAbsent(r.parent(), __ -> new ArrayList<>()).add(r.child());
      nodes.add(r.parent());
      nodes.add(r.child());
    }
    Map<String, Integer> color = new HashMap<>();
    for (String n : nodes) {
      color.putIfAbsent(n, 0);
    }
    for (String n : nodes) {
      if (color.get(n) == 0 && dfsCycle(n, adj, color)) {
        return true;
      }
    }
    return false;
  }

  private static boolean dfsCycle(
      String n, Map<String, List<String>> adj, Map<String, Integer> color) {
    color.put(n, 1);
    for (String w : adj.getOrDefault(n, List.of())) {
      int cw = color.getOrDefault(w, 0);
      if (cw == 1) {
        return true;
      }
      if (cw == 0 && dfsCycle(w, adj, color)) {
        return true;
      }
    }
    color.put(n, 2);
    return false;
  }

  private void trace(
      String repositoryName,
      String decisionKind,
      String targetType,
      String targetId,
      String fieldKey,
      List<String> citedFiles,
      List<String> observedFiles,
      String documentBody) {
    AiDecisionSourceService.Decision decision =
        new AiDecisionSourceService.Decision(
            AiDecisionSourceService.PIPELINE_MODULE,
            decisionKind,
            targetType,
            targetId,
            fieldKey,
            repositoryName,
            citedFiles,
            documentBody != null ? citedFiles : observedFiles);
    if (documentBody != null) {
      decisionSources.recordQuoted(decision);
      return;
    }
    decisionSources.record(decision);
  }

  private record Rel(String parent, String child, List<String> sourceFiles) {}
}
