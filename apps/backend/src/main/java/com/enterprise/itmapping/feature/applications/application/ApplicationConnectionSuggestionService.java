package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ConnectionDiscoveryAgent.DiscoveryResult;
import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload;
import com.enterprise.itmapping.feature.changedetection.application.DetectedChangeDrafts.ProposedConnection;
import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload.AiConnectionEntry;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.HumanFieldOverrideGuard;
import com.enterprise.itmapping.feature.datamodel.application.DataModelAttributeResolver;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributeReader;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeLinkService;
import com.enterprise.itmapping.feature.datamodel.application.DataModelPromptBuilder;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
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
import org.springframework.context.annotation.Lazy;
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

  static final Set<String> ALLOWED_DIRECTIONS = Set.of("outbound", "inbound");

  private final ApplicationRepository applicationRepository;
  private final GitHubRepoCloneService cloneService;
  private final ConnectionDiscoveryAgent connectionDiscoveryAgent;
  private final ConnectionDiscoveryProperties properties;
  private final ApplicationCatalogQuery catalogQuery;
  private final ApplicationConnectionEdgeWriter edgeWriter;
  private final SuggestedConnectionPersistence persistence;
  private final DataModelService dataModelService;
  private final DataModelPromptBuilder dataModelPromptBuilder;
  private final DataModelAttributeResolver dataModelAttributeResolver;
  private final ApplicationDetectionDocumentService documentService;

  public ApplicationConnectionSuggestionService(
      ApplicationRepository applicationRepository,
      GitHubRepoCloneService cloneService,
      ConnectionDiscoveryAgent connectionDiscoveryAgent,
      ConnectionDiscoveryProperties properties,
      ApplicationCatalogQuery catalogQuery,
      ApplicationConnectionEdgeWriter edgeWriter,
      @Lazy ApplicationNodeAttributePatchService nodeAttributePatchService,
      ApplicationNodeRefLinkWriter nodeRefLinkWriter,
      GraphEdgeAttributeReader edgeAttributeReader,
      AttributeChangeAuditService attributeChangeAuditService,
      GraphEdgeLinkService edgeLinkService,
      HumanFieldOverrideGuard overrideGuard,
      DataModelService dataModelService,
      DataModelPromptBuilder dataModelPromptBuilder,
      DataModelAttributeResolver dataModelAttributeResolver,
      AiDecisionSourceService decisionSources,
      ApplicationNodeRefLinkReader nodeRefLinkReader,
      ApplicationDetectionDocumentService documentService) {
    this.applicationRepository = applicationRepository;
    this.cloneService = cloneService;
    this.connectionDiscoveryAgent = connectionDiscoveryAgent;
    this.properties = properties;
    this.catalogQuery = catalogQuery;
    this.edgeWriter = edgeWriter;
    this.dataModelService = dataModelService;
    this.dataModelPromptBuilder = dataModelPromptBuilder;
    this.dataModelAttributeResolver = dataModelAttributeResolver;
    this.documentService = documentService;
    this.persistence =
        new SuggestedConnectionPersistence(
            edgeWriter,
            nodeAttributePatchService,
            nodeRefLinkWriter,
            edgeAttributeReader,
            attributeChangeAuditService,
            edgeLinkService,
            overrideGuard,
            dataModelAttributeResolver,
            decisionSources,
            nodeRefLinkReader);
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

    List<String> fullNames =
        GithubRepoIdentityResolver.resolveAllFullNames(appRow.getName(), appRow.getDescription());
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
          "Depot GitHub introuvable pour cette application: renseignez name=owner/repo, "
              + "description GitHub: https://..., ou fullName dans le corps.");
    }

    Catalog catalog = loadCatalog(applicationId);
    if (catalog.entries().isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Aucune autre application dans le graphe: impossible de deviner des connexions.");
    }

    String sourceName = StringUtils.hasText(appRow.getName()) ? appRow.getName() : applicationId;

    DataModelConfig dataModelConfig = dataModelService.loadConfig();
    String dataModelPromptSection =
        dataModelConfig.hasAutomaticFields()
            ? dataModelPromptBuilder.buildPromptSection(dataModelConfig)
            : "";
    if (!dataModelPromptSection.isBlank()) {
      String preview =
          dataModelPromptSection.length() > 400
              ? dataModelPromptSection.substring(0, 400) + "…"
              : dataModelPromptSection;
      log.debug("Data Model prompt section: {}", preview);
    }

    log.info(
        "Connection suggestion start applicationId={} repos={} catalogSize={}",
        applicationId,
        fullNames,
        catalog.entries().size());

    Path workspace;
    DiscoveryResult discovery;
    if (fullNames.size() == 1) {
      String[] parts = parseOwnerRepo(fullNames.get(0));
      workspace = cloneService.clone(parts[0], parts[1], properties.cloneTimeoutSeconds());
      discovery =
          connectionDiscoveryAgent.discover(
              workspace,
              parts[0],
              parts[1],
              sourceName,
              catalog.promptText(properties.maxCatalogAppsInPrompt()),
              dataModelPromptSection);
    } else {
      workspace = cloneService.cloneAll(fullNames, properties.cloneTimeoutSeconds());
      discovery =
          connectionDiscoveryAgent.discoverAll(
              workspace,
              fullNames,
              sourceName,
              catalog.promptText(properties.maxCatalogAppsInPrompt()),
              dataModelPromptSection);
    }
    try {
      return persistence.persist(
          applicationId,
          String.join(", ", fullNames),
          catalog,
          discovery,
          dataModelConfig,
          null,
          fullNames);
    } finally {
      cloneService.deleteQuietly(workspace);
    }
  }

  public SuggestConnectionsFromGithubResponse suggestFromDocument(String applicationId) {
    var appRow = requireApplication(applicationId);
    rejectGitHubLinked(appRow.getName(), appRow.getDescription());
    ApplicationDetectionDocumentService.StoredDocument document = documentService.require(applicationId);

    Catalog catalog = loadCatalog(applicationId);
    if (catalog.entries().isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Aucune autre application dans le graphe: impossible de deviner des connexions.");
    }

    String sourceName = StringUtils.hasText(appRow.getName()) ? appRow.getName() : applicationId;
    DataModelConfig dataModelConfig = dataModelService.loadConfig();
    String dataModelPromptSection =
        dataModelConfig.hasAutomaticFields()
            ? dataModelPromptBuilder.buildPromptSection(dataModelConfig)
            : "";
    DiscoveryResult discovery =
        connectionDiscoveryAgent.discoverFromDocument(
            sourceName,
            document.title(),
            document.body(),
            catalog.promptText(properties.maxCatalogAppsInPrompt()),
            dataModelPromptSection);
    return persistence.persist(
        applicationId,
        document.title(),
        catalog,
        discovery,
        dataModelConfig,
        document.body(),
        List.of());
  }

  /**
   * Reads a commit diff and returns catalogue connections it names. Nothing is written.
   */
  public List<ProposedConnection> proposeFromDiff(String applicationId, String diffText) {
    if (!StringUtils.hasText(diffText)) {
      return List.of();
    }
    ApplicationGraphNodeProjection appRow = requireApplication(applicationId);
    Catalog catalog = loadCatalog(applicationId);
    if (catalog.entries().isEmpty()) {
      return List.of();
    }
    DataModelConfig dataModelConfig = dataModelService.loadConfig();
    String dataModelPromptSection =
        dataModelConfig.hasAutomaticFields()
            ? dataModelPromptBuilder.buildPromptSection(dataModelConfig)
            : "";
    String sourceName = StringUtils.hasText(appRow.getName()) ? appRow.getName() : applicationId;
    DiscoveryResult discovery =
        connectionDiscoveryAgent.discoverFromDocument(
            sourceName,
            "commit diff",
            diffText,
            catalog.promptText(properties.maxCatalogAppsInPrompt()),
            dataModelPromptSection);
    List<ProposedConnection> proposed = new ArrayList<>();
    for (AiConnectionEntry entry : discovery.payload().getConnections()) {
      ProposedConnection connection = proposedConnection(applicationId, catalog, entry);
      if (connection != null) {
        proposed.add(connection);
      }
    }
    return List.copyOf(proposed);
  }

  /** Drops a proposal that matches a stored flow, or that would only fill in an existing one. */
  public List<ProposedConnection> onlyNewFlows(
      String applicationId, List<ProposedConnection> proposed) {
    if (proposed == null || proposed.isEmpty()) {
      return List.of();
    }
    Catalog catalog = loadCatalog(applicationId);
    Set<String> allowedEdgeKeys =
        dataModelAttributeResolver.allowedKeys(
            dataModelService.loadConfig(), DataModelTarget.EDGE);
    List<ProposedConnection> fresh = new ArrayList<>();
    for (ProposedConnection connection : proposed) {
      String peerId = catalog.nameToId().get(normalizeName(connection.peerName()));
      if (peerId == null) {
        continue;
      }
      boolean outbound = "outbound".equalsIgnoreCase(connection.direction());
      String sourceId = outbound ? applicationId : peerId;
      String targetId = outbound ? peerId : applicationId;
      if (edgeWriter.isNewFlow(sourceId, targetId, connection.edgeAttributes(), allowedEdgeKeys)) {
        fresh.add(connection);
      }
    }
    return List.copyOf(fresh);
  }

  /** Writes one connection already deduced from a diff. Does not clone or call the model again. */
  public void applyProposedConnection(
      String applicationId,
      String peerName,
      String direction,
      Map<String, Object> edgeAttributes) {
    AiConnectionEntry entry = new AiConnectionEntry();
    entry.setPeerApplicationName(peerName);
    entry.setDirection(direction);
    entry.setEdgeAttributes(edgeAttributes != null ? edgeAttributes : Map.of());
    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(List.of(entry));
    DiscoveryResult discovery = new DiscoveryResult(payload, List.of(), List.of());
    SuggestConnectionsFromGithubResponse response =
        persistence.persist(
            applicationId,
            "change-detection",
            loadCatalog(applicationId),
            discovery,
            dataModelService.loadConfig(),
            null,
            List.of());
    if (response.created().isEmpty()) {
      String reason =
          response.skipped().isEmpty()
              ? "not written"
              : response.skipped().get(0).reason() + " " + response.skipped().get(0).detail();
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Connection was not written: " + reason);
    }
  }

  private ProposedConnection proposedConnection(
      String applicationId, Catalog catalog, AiConnectionEntry entry) {
    String peerName = entry.getPeerApplicationName();
    String direction = entry.getDirection();
    if (!StringUtils.hasText(peerName) || !ALLOWED_DIRECTIONS.contains(direction)) {
      return null;
    }
    String key = normalizeName(peerName);
    if (catalog.ambiguousNames().contains(key)) {
      return null;
    }
    String peerId = catalog.nameToId().get(key);
    if (peerId == null || peerId.equals(applicationId)) {
      return null;
    }
    return new ProposedConnection(peerName, direction, entry.getEdgeAttributes());
  }

  private ApplicationGraphNodeProjection requireApplication(String applicationId) {
    return applicationRepository
        .findProjectionById(applicationId)
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Application introuvable: " + applicationId));
  }

  private static void rejectGitHubLinked(String name, String description) {
    if (GithubRepoIdentityResolver.resolveFullName(name, description, null).isPresent()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "This application is linked to GitHub.");
    }
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

  static String normalizeName(String name) {
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

  record Catalog(
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
