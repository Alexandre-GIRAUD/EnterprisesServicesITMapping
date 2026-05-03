package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.common.Neo4jTemporalParameters;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload.AiModuleEntry;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload.AiRelationshipEntry;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse.CreatedItem;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse.SkippedItem;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubRepoTreeService;
import com.enterprise.itmapping.feature.integrations.llm.LlmModuleSuggestionProperties;
import com.enterprise.itmapping.feature.integrations.llm.OpenAiChatJsonClient;
import com.enterprise.itmapping.feature.integrations.github.GithubTreePathFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpStatus;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Fetches repo tree paths, prompts an LLM, validates evidence-only JSON, persists {@code Module}
 * subgraph as {@code CONTAINS} rooted at the {@link
 * com.enterprise.itmapping.domain.Application}.
 *
 * <p><strong>Edge strategy (MVP):</strong> only {@code structural_contains} from the IA is materialized
 * as Neo4j {@code CONTAINS}. {@code structural_adjacency} is never emitted by the prompt and is ignored
 * if present.
 *
 * <p><strong>Idempotence:</strong> if the application already has at least one {@code Module} reachable
 * via outbound {@code CONTAINS}, returns {@code 409 Conflict} without calling GitHub or the LLM (retry
 * allowed when the subtree is empty, e.g. all modules removed).
 */
@Service
public class ModuleSuggestionService {

  private static final java.util.regex.Pattern SLUG_PATTERN =
      java.util.regex.Pattern.compile("[a-z][a-z0-9_.-]{1,127}");

  private final ApplicationRepository applicationRepository;
  private final GitHubRepoTreeService gitHubRepoTreeService;
  private final OpenAiChatJsonClient openAiChatJsonClient;
  private final LlmModuleSuggestionProperties llmProperties;
  private final Neo4jClient neo4jClient;
  private final ObjectMapper objectMapper;
  private final ResourceLoader resourceLoader;
  private final ObjectProvider<ModuleSuggestionService> self;
  private final ApplicationModuleSubtreeQuery moduleSubtreeQuery;

  public ModuleSuggestionService(
      ApplicationRepository applicationRepository,
      GitHubRepoTreeService gitHubRepoTreeService,
      OpenAiChatJsonClient openAiChatJsonClient,
      LlmModuleSuggestionProperties llmProperties,
      Neo4jClient neo4jClient,
      ObjectMapper objectMapper,
      ResourceLoader resourceLoader,
      ObjectProvider<ModuleSuggestionService> self,
      ApplicationModuleSubtreeQuery moduleSubtreeQuery) {
    this.applicationRepository = applicationRepository;
    this.gitHubRepoTreeService = gitHubRepoTreeService;
    this.openAiChatJsonClient = openAiChatJsonClient;
    this.llmProperties = llmProperties;
    this.neo4jClient = neo4jClient;
    this.objectMapper = objectMapper;
    this.resourceLoader = resourceLoader;
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
          HttpStatus.CONFLICT,
          "Les modules ont déjà été suggérés pour cette application.");
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

    List<String> paths =
        gitHubRepoTreeService.fetchFilteredTreePaths(owner, repo, llmProperties.maxPathsInPrompt());
    if (paths.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Aucun chemin exploitable apres filtrage pour ce depot.");
    }

    Set<String> pathSet = new LinkedHashSet<>(paths);
    String systemPrompt = loadSystemPrompt();
    String userPrompt = buildUserPrompt(paths);

    String rawJson;
    try {
      rawJson = openAiChatJsonClient.completeJson(systemPrompt, userPrompt);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Echec appel LLM: " + e.getMessage(), e);
    }

    AiModuleSuggestionPayload payload;
    try {
      payload = objectMapper.readValue(rawJson, AiModuleSuggestionPayload.class);
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Reponse IA non JSON ou schema illisible: " + e.getMessage());
    }

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
      if (!ModuleSuggestionEvidenceValidator.allEvidenceMatches(mod.getEvidencePaths(), pathSet)) {
        skipped.add(new SkippedItem("module", "evidence_paths_non_observes", slug));
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
                "relationship", "kind_non_supporte_v1", r.getFromModuleId() + "->" + r.getToModuleId()));
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
      if (r.getEvidencePaths() == null
          || r.getEvidencePaths().isEmpty()
          || !ModuleSuggestionEvidenceValidator.allEvidenceMatches(r.getEvidencePaths(), pathSet)) {
        skipped.add(new SkippedItem("relationship", "evidence_manquante", r.getFromModuleId() + "->" + r.getToModuleId()));
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
    Instant now = Instant.now();
    var vf = Neo4jTemporalParameters.toNeo4j(now);

    for (Map.Entry<String, AiModuleEntry> e : acceptedBySlug.entrySet()) {
      String neoId = UUID.randomUUID().toString();
      slugToNeoId.put(e.getKey(), neoId);
      String desc = e.getValue().getDescriptionMetierBreve();
      if (!StringUtils.hasText(desc)) {
        desc = "Module suggere (IA) — " + e.getKey();
      }

      neo4jClient
          .query(
              """
              CREATE (m:Module {id: $id, name: $name, description: $desc, validFrom: $vf, validTo: null})
              """)
          .bind(neoId)
          .to("id")
          .bind(e.getValue().getBusinessName())
          .to("name")
          .bind(desc)
          .to("desc")
          .bind(vf)
          .to("vf")
          .run();

      created.add(new CreatedItem(neoId, e.getKey(), e.getValue().getBusinessName()));
    }

    for (String slug : acceptedBySlug.keySet()) {
      if (!children.contains(slug)) {
        linkApplicationContains(applicationId, slugToNeoId.get(slug), vf);
      }
    }

    for (Rel rel : relsAccepted) {
      linkModuleContains(slugToNeoId.get(rel.parent()), slugToNeoId.get(rel.child()), vf);
    }

    return new SuggestModulesFromGithubResponse(List.copyOf(created), List.copyOf(skipped));
  }

  private void linkApplicationContains(String applicationId, String moduleNeoId, java.time.ZonedDateTime vf) {
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $appId})
            MATCH (m:Module {id: $mid})
            CREATE (a)-[:CONTAINS {validFrom: $vf, validTo: null}]->(m)
            """)
        .bind(applicationId)
        .to("appId")
        .bind(moduleNeoId)
        .to("mid")
        .bind(vf)
        .to("vf")
        .run();
  }

  private void linkModuleContains(String parentNeoId, String childNeoId, java.time.ZonedDateTime vf) {
    neo4jClient
        .query(
            """
            MATCH (p:Module {id: $pid})
            MATCH (c:Module {id: $cid})
            CREATE (p)-[:CONTAINS {validFrom: $vf, validTo: null}]->(c)
            """)
        .bind(parentNeoId)
        .to("pid")
        .bind(childNeoId)
        .to("cid")
        .bind(vf)
        .to("vf")
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

  private String loadSystemPrompt() {
    Resource r = resourceLoader.getResource("classpath:prompts/module-suggest-system.txt");
    if (!r.exists()) {
      throw new IllegalStateException("classpath:prompts/module-suggest-system.txt manquant.");
    }
    try {
      return new String(r.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new IllegalStateException("Impossible de lire le prompt system module-suggest.", e);
    }
  }

  private String buildUserPrompt(List<String> paths) {
    StringBuilder sb = new StringBuilder();
    sb.append(
        "Liste des chemins du depot (POSIX, sans secret). Deduis modules metier uniquement.\n\n");
    for (String p : paths) {
      sb.append(p).append('\n');
      if (sb.length() >= llmProperties.maxUserPromptChars()) {
        sb.append("\n... (tronque pour limite technique)\n");
        break;
      }
    }
    return sb.toString();
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

  private static boolean dfsCycle(String n, Map<String, List<String>> adj, Map<String, Integer> color) {
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