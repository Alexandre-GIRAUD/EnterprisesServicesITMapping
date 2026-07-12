package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.ModuleDiscoveryAgent.DiscoveryResult;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload.AiModuleEntry;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload.AiRelationshipEntry;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse.CreatedItem;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse.SkippedItem;
import com.enterprise.itmapping.feature.integrations.github.GithubTreePathFilter;
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

  public ModuleSuggestionService(
      ApplicationRepository applicationRepository,
      GitHubRepoCloneService cloneService,
      ModuleDiscoveryAgent moduleDiscoveryAgent,
      ModuleDiscoveryProperties properties,
      Neo4jClient neo4jClient,
      ObjectProvider<ModuleSuggestionService> self,
      ApplicationModuleSubtreeQuery moduleSubtreeQuery) {
    this.applicationRepository = applicationRepository;
    this.cloneService = cloneService;
    this.moduleDiscoveryAgent = moduleDiscoveryAgent;
    this.properties = properties;
    this.neo4jClient = neo4jClient;
    this.self = self;
    this.moduleSubtreeQuery = moduleSubtreeQuery;
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
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Les modules ont déjà été suggérés pour cette application.");
    }

    String fullName =
        GithubRepoIdentityResolver.resolveFullName(
                appRow.getName(), appRow.getDescription(), request != null ? request.fullName() : null)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Depot GitHub introuvable pour cette application: renseignez name=owner/repo, "
                            + "description GitHub: https://..., ou fullName dans le corps."));

    String[] parts = parseOwnerRepo(fullName);
    String owner = parts[0];
    String repo = parts[1];

    log.info("Module suggestion start applicationId={} repo={}/{}", applicationId, owner, repo);

    Path workspace = cloneService.clone(owner, repo, properties.cloneTimeoutSeconds());
    try {
      DiscoveryResult discovery = moduleDiscoveryAgent.discover(workspace, owner, repo);
      return persist(applicationId, appRow.getYear(), discovery);
    } finally {
      cloneService.deleteQuietly(workspace);
    }
  }

  private SuggestModulesFromGithubResponse persist(
      String applicationId, Integer moduleYear, DiscoveryResult discovery) {

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
        skipped.add(new SkippedItem("module", "doublon_slug_ia", slug));
        continue;
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
      relsAccepted.add(new Rel(r.getFromModuleId(), r.getToModuleId()));
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
      params.put("year", moduleYear);
      neo4jClient
          .query("CREATE (m:Module {id: $id, name: $name, description: $desc, year: $year})")
          .bindAll(params)
          .run();

      created.add(new CreatedItem(neoId, e.getKey(), e.getValue().getBusinessName()));
    }

    for (String slug : acceptedBySlug.keySet()) {
      if (!children.contains(slug)) {
        linkApplicationContains(applicationId, slugToNeoId.get(slug));
      }
    }

    for (Rel rel : relsAccepted) {
      linkModuleContains(slugToNeoId.get(rel.parent()), slugToNeoId.get(rel.child()));
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

  private static String[] parseOwnerRepo(String fullName) {
    String f = GithubTreePathFilter.normalizePath(fullName);
    int slash = f.indexOf('/');
    if (slash <= 0 || slash == f.length() - 1) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fullName doit etre owner/repo.");
    }
    String owner = f.substring(0, slash).trim();
    String repo = f.substring(slash + 1).trim();
    return new String[] {owner, repo};
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

  private record Rel(String parent, String child) {}
}
