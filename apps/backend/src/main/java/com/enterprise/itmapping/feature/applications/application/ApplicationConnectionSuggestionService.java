package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ConnectionDiscoveryAgent.DiscoveryResult;
import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload.AiConnectionEntry;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse.CreatedConnectionItem;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse.SkippedItem;
import com.enterprise.itmapping.feature.datamodel.application.DataModelAttributeResolver;
import com.enterprise.itmapping.feature.datamodel.application.DataModelAttributeResolver.ValidationResult;
import com.enterprise.itmapping.feature.datamodel.application.DataModelPromptBuilder;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.integrations.github.GithubTreePathFilter;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubRepoCloneService;
import com.enterprise.itmapping.feature.integrations.llm.ConnectionDiscoveryProperties;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Clones the GitHub repository of an application, runs a Spring AI agent (ReAct + grep/read/list
 * tools) to discover integration connections with other applications of the Neo4j catalogue, and
 * persists them as {@code DEPENDS_ON} edges between {@code Application} nodes.
 *
 * <p><strong>Direction</strong> from the analyzed-app perspective decides the Neo4j edge
 * orientation: {@code outbound} → {@code (analyzed)-[:DEPENDS_ON]->(peer)}, {@code inbound} → {@code
 * (peer)-[:DEPENDS_ON]->(analyzed)}.
 *
 * <p><strong>Idempotence</strong>: unlike module suggestion there is no global {@code 409}; re-runs
 * are allowed and duplicate edges are skipped by {@link ApplicationConnectionEdgeWriter}.
 */
@Service
public class ApplicationConnectionSuggestionService {

  private static final Logger log =
      LoggerFactory.getLogger(ApplicationConnectionSuggestionService.class);

  private static final Set<String> ALLOWED_KINDS =
      Set.of(
          "API",
          "MQ",
          "KAFKA",
          "NAS",
          "DATABASE",
          "GRPC",
          "SOAP",
          "SFTP",
          "FILE_SHARE",
          "OTHER");

  private static final Set<String> ALLOWED_DIRECTIONS = Set.of("outbound", "inbound");

  private final ApplicationRepository applicationRepository;
  private final GitHubRepoCloneService cloneService;
  private final ConnectionDiscoveryAgent connectionDiscoveryAgent;
  private final ConnectionDiscoveryProperties properties;
  private final ApplicationCatalogQuery catalogQuery;
  private final ApplicationConnectionEdgeWriter edgeWriter;
  private final DataModelService dataModelService;
  private final DataModelPromptBuilder dataModelPromptBuilder;
  private final DataModelAttributeResolver dataModelAttributeResolver;

  public ApplicationConnectionSuggestionService(
      ApplicationRepository applicationRepository,
      GitHubRepoCloneService cloneService,
      ConnectionDiscoveryAgent connectionDiscoveryAgent,
      ConnectionDiscoveryProperties properties,
      ApplicationCatalogQuery catalogQuery,
      ApplicationConnectionEdgeWriter edgeWriter,
      DataModelService dataModelService,
      DataModelPromptBuilder dataModelPromptBuilder,
      DataModelAttributeResolver dataModelAttributeResolver) {
    this.applicationRepository = applicationRepository;
    this.cloneService = cloneService;
    this.connectionDiscoveryAgent = connectionDiscoveryAgent;
    this.properties = properties;
    this.catalogQuery = catalogQuery;
    this.edgeWriter = edgeWriter;
    this.dataModelService = dataModelService;
    this.dataModelPromptBuilder = dataModelPromptBuilder;
    this.dataModelAttributeResolver = dataModelAttributeResolver;
  }

  public SuggestConnectionsFromGithubResponse suggestFromGithub(
      String applicationId, SuggestConnectionsFromGithubRequest request) {

    var appRow =
        applicationRepository
            .findProjectionById(applicationId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Application introuvable: " + applicationId));

    String fullName =
        GithubRepoIdentityResolver.resolveFullName(
                appRow.getName(),
                appRow.getDescription(),
                request != null ? request.fullName() : null)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Depot GitHub introuvable pour cette application: renseignez name=owner/repo, "
                            + "description GitHub: https://..., ou fullName dans le corps."));

    String[] parts = parseOwnerRepo(fullName);
    String owner = parts[0];
    String repo = parts[1];

    Catalog catalog = loadCatalog(applicationId);
    if (catalog.entries().isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Aucune autre application dans le graphe: impossible de deviner des connexions.");
    }

    String sourceName = StringUtils.hasText(appRow.getName()) ? appRow.getName() : applicationId;

    DataModelConfig dataModelConfig = dataModelService.loadConfig();
    String dataModelPromptSection =
        dataModelConfig.isEmpty() ? "" : dataModelPromptBuilder.buildPromptSection(dataModelConfig);
    if (!dataModelPromptSection.isBlank()) {
      String preview =
          dataModelPromptSection.length() > 400
              ? dataModelPromptSection.substring(0, 400) + "…"
              : dataModelPromptSection;
      log.debug("Data Model prompt section: {}", preview);
    }

    log.info(
        "Connection suggestion start applicationId={} repo={}/{} catalogSize={} dataModelFields={}",
        applicationId,
        owner,
        repo,
        catalog.entries().size(),
        dataModelConfig.fields().size());

    Path workspace = cloneService.clone(owner, repo, properties.cloneTimeoutSeconds());
    try {
      DiscoveryResult discovery =
          connectionDiscoveryAgent.discover(
              workspace,
              owner,
              repo,
              sourceName,
              catalog.promptText(properties.maxCatalogAppsInPrompt()),
              dataModelPromptSection);
      return persist(applicationId, catalog, discovery, dataModelConfig);
    } finally {
      cloneService.deleteQuietly(workspace);
    }
  }

  private SuggestConnectionsFromGithubResponse persist(
      String applicationId,
      Catalog catalog,
      DiscoveryResult discovery,
      DataModelConfig dataModelConfig) {

    List<CreatedConnectionItem> created = new ArrayList<>();
    List<SkippedItem> skipped = new ArrayList<>();
    int outbound = 0;
    int inbound = 0;
    Set<String> allowedDataModelKeys = dataModelAttributeResolver.allowedKeys(dataModelConfig);

    for (AiConnectionEntry entry : discovery.payload().getConnections()) {
      String peerName = entry.getPeerApplicationName();
      if (!StringUtils.hasText(peerName)) {
        skipped.add(new SkippedItem("connection", "peer_manquant", String.valueOf(entry)));
        continue;
      }

      String normalizedName = normalizeName(peerName);
      if (catalog.ambiguousNames().contains(normalizedName)) {
        skipped.add(new SkippedItem("connection", "peer_ambigu", peerName));
        continue;
      }
      String peerId = catalog.nameToId().get(normalizedName);
      if (peerId == null) {
        skipped.add(new SkippedItem("connection", "peer_inconnu", peerName));
        continue;
      }
      if (peerId.equals(applicationId)) {
        skipped.add(new SkippedItem("connection", "self_loop", peerName));
        continue;
      }

      String direction = entry.getDirection();
      if (!ALLOWED_DIRECTIONS.contains(direction)) {
        skipped.add(
            new SkippedItem("connection", "direction_invalide", peerName + ": " + direction));
        continue;
      }

      String kind = entry.getConnectionKind();
      if (!ALLOWED_KINDS.contains(kind)) {
        skipped.add(new SkippedItem("connection", "kind_invalide", peerName + ": " + kind));
        continue;
      }

      String confidence = entry.getConfidence();
      if (properties.skipLowConfidence() && "low".equals(confidence)) {
        skipped.add(new SkippedItem("connection", "confidence_trop_basse", peerName));
        continue;
      }

      Map<String, String> validatedAttributes = Map.of();
      if (!dataModelConfig.isEmpty()) {
        ValidationResult validation =
            dataModelAttributeResolver.validate(dataModelConfig, entry.getEdgeAttributes());
        if (!validation.accepted()) {
          skipped.add(
              new SkippedItem(
                  "connection", validation.skipReason(), peerName + ": " + validation.skipDetail()));
          continue;
        }
        validatedAttributes = validation.attributes();
        for (Map.Entry<String, String> attr : validatedAttributes.entrySet()) {
          log.debug(
              "Data Model attribute accepted peer={} key={} value={}",
              peerName,
              attr.getKey(),
              attr.getValue());
        }
      } else if (!entry.getEdgeAttributes().isEmpty()) {
        log.debug(
            "Ignoring edge_attributes from LLM (no Data Model configured) peer={} keys={}",
            peerName,
            entry.getEdgeAttributes().keySet());
      }

      String sourceId;
      String targetId;
      if ("outbound".equals(direction)) {
        sourceId = applicationId;
        targetId = peerId;
      } else {
        sourceId = peerId;
        targetId = applicationId;
      }

      var result =
          edgeWriter.createOrMerge(
              sourceId,
              targetId,
              kind,
              entry.getChannel(),
              direction,
              confidence,
              applicationId,
              validatedAttributes,
              allowedDataModelKeys);

      switch (result.outcome()) {
        case DUPLICATE ->
            skipped.add(
                new SkippedItem(
                    "connection", "doublon", peerName + " [" + kind + " " + entry.getChannel() + "]"));
        case CREATED, MERGED -> {
          created.add(
              new CreatedConnectionItem(
                  result.edgeId(),
                  sourceId,
                  targetId,
                  peerName,
                  direction,
                  kind,
                  entry.getChannel()));
          if ("outbound".equals(direction)) {
            outbound++;
          } else {
            inbound++;
          }
        }
      }
    }

    log.info(
        "Connection suggestion result applicationId={} created={} (outbound={} inbound={}) skipped={} analyzedFiles={}",
        applicationId,
        created.size(),
        outbound,
        inbound,
        skipped.size(),
        discovery.analyzedFiles().size());
    for (SkippedItem item : skipped) {
      log.debug(
          "Connection suggestion skipped scope={} reason={} detail={}",
          item.scope(),
          item.reason(),
          item.detail());
    }

    return new SuggestConnectionsFromGithubResponse(
        List.copyOf(created), List.copyOf(skipped), List.copyOf(discovery.analyzedFiles()));
  }

  private Catalog loadCatalog(String excludeApplicationId) {
    List<CatalogRow> rows = catalogQuery.loadExcluding(excludeApplicationId);

    Map<String, String> nameToId = new LinkedHashMap<>();
    Set<String> ambiguous = new HashSet<>();
    for (CatalogRow e : rows) {
      String key = normalizeName(e.name());
      if (key.isEmpty()) {
        continue;
      }
      String existing = nameToId.putIfAbsent(key, e.id());
      if (existing != null && !existing.equals(e.id())) {
        ambiguous.add(key);
      }
    }
    return new Catalog(List.copyOf(rows), nameToId, ambiguous);
  }

  private static String normalizeName(String name) {
    if (name == null) {
      return "";
    }
    return name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
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

  private record Catalog(
      List<CatalogRow> entries, Map<String, String> nameToId, Set<String> ambiguousNames) {

    String promptText(int maxApps) {
      int limit = maxApps > 0 ? Math.min(maxApps, entries.size()) : entries.size();
      StringBuilder sb = new StringBuilder();
      for (int i = 0; i < limit; i++) {
        CatalogRow e = entries.get(i);
        sb.append("- ").append(e.name()).append(" | ").append(e.id());
        if (StringUtils.hasText(e.description())) {
          String desc = e.description().trim();
          if (desc.length() > 120) {
            desc = desc.substring(0, 120) + "…";
          }
          sb.append(" — ").append(desc);
        }
        sb.append('\n');
      }
      if (entries.size() > limit) {
        sb.append("... (").append(entries.size() - limit).append(" more applications)\n");
      }
      return sb.toString();
    }
  }
}
