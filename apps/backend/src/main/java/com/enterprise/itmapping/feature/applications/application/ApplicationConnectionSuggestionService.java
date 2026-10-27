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
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse.CreatedConnectionItem;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse.SkippedItem;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.application.HumanFieldOverrideGuard;
import com.enterprise.itmapping.feature.attributeaudit.application.HumanFieldOverrideGuard.Decision;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.datamodel.application.AttributeValues;
import com.enterprise.itmapping.feature.datamodel.application.DataModelAttributeResolver;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributeReader;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeLinkService;
import com.enterprise.itmapping.feature.datamodel.application.DataModelAttributeResolver.ValidationResult;
import com.enterprise.itmapping.feature.datamodel.application.DataModelPromptBuilder;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
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
import java.util.Objects;
import java.util.Optional;
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

  private static final Set<String> ALLOWED_DIRECTIONS = Set.of("outbound", "inbound");

  private final ApplicationRepository applicationRepository;
  private final GitHubRepoCloneService cloneService;
  private final ConnectionDiscoveryAgent connectionDiscoveryAgent;
  private final ConnectionDiscoveryProperties properties;
  private final ApplicationCatalogQuery catalogQuery;
  private final ApplicationConnectionEdgeWriter edgeWriter;
  private final ApplicationNodeAttributePatchService nodeAttributePatchService;
  private final ApplicationNodeRefLinkWriter nodeRefLinkWriter;
  private final GraphEdgeAttributeReader edgeAttributeReader;
  private final AttributeChangeAuditService attributeChangeAuditService;
  private final GraphEdgeLinkService edgeLinkService;
  private final HumanFieldOverrideGuard overrideGuard;
  private final DataModelService dataModelService;
  private final DataModelPromptBuilder dataModelPromptBuilder;
  private final DataModelAttributeResolver dataModelAttributeResolver;
  private final AiDecisionSourceService decisionSources;
  private final ApplicationNodeRefLinkReader nodeRefLinkReader;
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
    this.nodeAttributePatchService = nodeAttributePatchService;
    this.nodeRefLinkWriter = nodeRefLinkWriter;
    this.edgeAttributeReader = edgeAttributeReader;
    this.attributeChangeAuditService = attributeChangeAuditService;
    this.edgeLinkService = edgeLinkService;
    this.overrideGuard = overrideGuard;
    this.dataModelService = dataModelService;
    this.dataModelPromptBuilder = dataModelPromptBuilder;
    this.dataModelAttributeResolver = dataModelAttributeResolver;
    this.decisionSources = decisionSources;
    this.nodeRefLinkReader = nodeRefLinkReader;
    this.documentService = documentService;
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
      return persist(
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
    return persist(
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
        persist(
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

  private SuggestConnectionsFromGithubResponse persist(
      String applicationId,
      String repositoryName,
      Catalog catalog,
      DiscoveryResult discovery,
      DataModelConfig dataModelConfig,
      String documentBody,
      List<String> ownRepositories) {

    List<CreatedConnectionItem> created = new ArrayList<>();
    List<SkippedItem> skipped = new ArrayList<>();
    int outbound = 0;
    int inbound = 0;
    Set<String> allowedEdgeKeys =
        dataModelAttributeResolver.allowedKeys(dataModelConfig, DataModelTarget.EDGE);

    for (AiConnectionEntry entry : discovery.payload().getConnections()) {
      String peerName = entry.getPeerApplicationName();
      if (!StringUtils.hasText(peerName)) {
        skipped.add(new SkippedItem("connection", "peer_manquant", String.valueOf(entry)));
        continue;
      }
      if (GithubRepoIdentityResolver.namesOwnRepository(peerName, ownRepositories)) {
        skipped.add(new SkippedItem("connection", "depot_interne", peerName));
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

      // Transport fields are not data-model attributes. They are not searched or stored.

      if (documentBody != null) {
        List<String> quotes = DocumentExcerpt.matching(documentBody, entry.citedSourceFiles());
        if (quotes.isEmpty()) {
          skipped.add(new SkippedItem("connection", "evidence_absente", peerName));
          continue;
        }
        entry.setSourceFiles(quotes);
      }

      Map<String, Object> validatedAttributes = Map.of();
      if (dataModelConfig.hasAutomaticEdgeFields()) {
        ValidationResult validation =
            dataModelAttributeResolver.validate(
                dataModelConfig, entry.getEdgeAttributes(), DataModelTarget.EDGE);
        if (!validation.accepted()) {
          skipped.add(
              new SkippedItem(
                  "connection", validation.skipReason(), peerName + ": " + validation.skipDetail()));
          continue;
        }
        validatedAttributes =
            shapeForStorage(dataModelConfig, DataModelTarget.EDGE, validation.attributes());
        for (Map.Entry<String, Object> attr : validatedAttributes.entrySet()) {
          log.debug(
              "Data Model edge attribute accepted peer={} key={} value={}",
              peerName,
              attr.getKey(),
              attr.getValue());
        }
      } else if (!entry.getEdgeAttributes().isEmpty()) {
        log.debug(
            "Ignoring edge_attributes from LLM (no automatic EDGE Data Model fields) peer={} keys={}",
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

      Map<String, Object> beforeEdgeAttrs = Map.of();
      Map<String, Object> attrsForWrite = validatedAttributes;
      Optional<String> bareEdgeId = Optional.empty();
      if (!validatedAttributes.isEmpty()) {
        bareEdgeId = edgeWriter.findBareEdgeId(sourceId, targetId, validatedAttributes.keySet());
        beforeEdgeAttrs = bareEdgeId.map(edgeAttributeReader::read).orElse(Map.of());
        if (bareEdgeId.isPresent()) {
          attrsForWrite =
              filterAiAllowedEdgeAttrs(bareEdgeId.get(), validatedAttributes, "CONNECTION_SUGGESTION");
        }
      }

      var result =
          edgeWriter.createOrMerge(
              sourceId,
              targetId,
              "",
              "",
              direction,
              "",
              applicationId,
              attrsForWrite,
              allowedEdgeKeys);

      switch (result.outcome()) {
        case DUPLICATE ->
            skipped.add(
                new SkippedItem(
                    "connection", "doublon", peerName));
        case CREATED, MERGED -> {
          created.add(
              new CreatedConnectionItem(
                  result.edgeId(),
                  sourceId,
                  targetId,
                  peerName,
                  direction,
                  "",
                  ""));
          if ("outbound".equals(direction)) {
            outbound++;
          } else {
            inbound++;
          }
          recordEdgeAttributeAiEvents(
              result.edgeId(),
              attrsForWrite,
              beforeEdgeAttrs,
              result.outcome(),
              repositoryName,
              entry.citedSourceFiles(),
              discovery.observedFiles(),
              documentBody);
          if (result.outcome() == ApplicationConnectionEdgeWriter.Outcome.CREATED) {
            edgeLinkService.recordCreateAiFromIds(
                result.edgeId(),
                sourceId,
                targetId,
                "DEPENDS_ON",
                auditText(attrsForWrite),
                "",
                "",
                null,
                "CONNECTION_SUGGESTION");
            traceEvidence(
                repositoryName,
                AiDecisionSourceService.KIND_EDGE,
                AiDecisionSourceService.TARGET_EDGE,
                result.edgeId(),
                GraphEdgeLinkService.LINK_FIELD_KEY,
                entry.citedSourceFiles(),
                discovery.observedFiles(),
                documentBody);
          }
        }
      }
    }

    persistNodeAttributes(applicationId, repositoryName, discovery, dataModelConfig, documentBody);
    persistNodeRefs(applicationId, repositoryName, discovery, dataModelConfig, documentBody);

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

  /**
   * Validates and persists root-level {@code node_attributes} on the analyzed Application.
   *
   * <p>v1 policy: NODE validation soft-fails — WARN + skip node enrichment; edges already validated
   * remain persisted.
   */
  private void persistNodeAttributes(
      String applicationId,
      String repositoryName,
      DiscoveryResult discovery,
      DataModelConfig dataModelConfig,
      String documentBody) {
    Map<String, Object> rawNodeAttrs = discovery.payload().getNodeAttributes();
    if (!dataModelConfig.hasAutomaticNodeFields()) {
      if (!rawNodeAttrs.isEmpty()) {
        log.debug(
            "Ignoring node_attributes from LLM (no automatic NODE Data Model fields) keys={}",
            rawNodeAttrs.keySet());
      }
      return;
    }

    ValidationResult validation =
        dataModelAttributeResolver.validate(dataModelConfig, rawNodeAttrs, DataModelTarget.NODE);
    if (!validation.accepted()) {
      log.warn(
          "Skipping Application node Data Model enrichment applicationId={} reason={} detail={} (edges unaffected)",
          applicationId,
          validation.skipReason(),
          validation.skipDetail());
      return;
    }

    Map<String, List<String>> attrs = validation.attributes();
    if (attrs.isEmpty()) {
      log.debug("No validated node_attributes to persist applicationId={}", applicationId);
      return;
    }
    List<String> citedFiles = discovery.payload().getNodeSourceFiles();
    List<String> observedFiles = discovery.observedFiles();
    if (documentBody != null) {
      citedFiles = DocumentExcerpt.matching(documentBody, citedFiles);
      if (citedFiles.isEmpty()) {
        log.warn(
            "Skipping Application node Data Model enrichment applicationId={} reason=evidence_absente (edges unaffected)",
            applicationId);
        return;
      }
      observedFiles = citedFiles;
    }

    for (Map.Entry<String, List<String>> attr : attrs.entrySet()) {
      log.debug(
          "Data Model node attribute accepted applicationId={} key={} value={}",
          applicationId,
          attr.getKey(),
          attr.getValue());
    }

    Set<String> allowedNodeKeys =
        dataModelAttributeResolver.allowedKeys(dataModelConfig, DataModelTarget.NODE);
    // Routes through patchAi so human overrides block + enqueue Conflicts.
    Set<String> changedKeys =
        nodeAttributePatchService.patchAi(applicationId, attrs, "CONNECTION_SUGGESTION");
    if (changedKeys != null) {
      for (String key : changedKeys) {
        traceEvidence(
            repositoryName,
            AiDecisionSourceService.KIND_NODE_PROPERTY,
            AiDecisionSourceService.TARGET_APPLICATION,
            applicationId,
            key,
            citedFiles,
            observedFiles,
            documentBody);
      }
    }
    log.debug(
        "Application node Data Model write via patchAi applicationId={} keys={} allowed={}",
        applicationId,
        attrs.keySet(),
        allowedNodeKeys);
  }

  private Map<String, Object> filterAiAllowedEdgeAttrs(
      String edgeId, Map<String, Object> attrs, String aiSource) {
    Map<String, Object> allowed = new LinkedHashMap<>();
    for (Map.Entry<String, Object> attr : attrs.entrySet()) {
      Decision decision =
          overrideGuard.checkAiWrite(
              AuditTargetType.EDGE,
              edgeId,
              AuditFieldScope.EDGE_ATTR,
              attr.getKey(),
              AttributeValues.display(attr.getValue()),
              aiSource);
      if (decision == Decision.ALLOW) {
        allowed.put(attr.getKey(), attr.getValue());
      }
    }
    return allowed;
  }

  private void recordEdgeAttributeAiEvents(
      String edgeId,
      Map<String, ?> attrs,
      Map<String, ?> beforeAttrs,
      ApplicationConnectionEdgeWriter.Outcome outcome,
      String repositoryName,
      List<String> citedFiles,
      List<String> observedFiles,
      String documentBody) {
    if (attrs == null || attrs.isEmpty() || !StringUtils.hasText(edgeId)) {
      return;
    }
    Map<String, ?> before =
        outcome == ApplicationConnectionEdgeWriter.Outcome.CREATED
            ? Map.of()
            : (beforeAttrs != null ? beforeAttrs : Map.of());
    List<AttributeChangeRequest> events = new ArrayList<>();
    for (Map.Entry<String, ?> attr : attrs.entrySet()) {
      String previous = before.get(attr.getKey()) == null ? null : AttributeValues.display(before.get(attr.getKey()));
      String next = AttributeValues.display(attr.getValue());
      String previousValue = previous == null || previous.isEmpty() ? null : previous;
      String nextValue = next.isEmpty() ? null : next;
      events.add(
          AttributeChangeRequest.ai(
              AuditTargetType.EDGE,
              edgeId,
              AuditFieldScope.EDGE_ATTR,
              attr.getKey(),
              previousValue,
              nextValue,
              "CONNECTION_SUGGESTION"));
      if (!Objects.equals(previousValue, nextValue)) {
        traceEvidence(
            repositoryName,
            AiDecisionSourceService.KIND_EDGE_PROPERTY,
            AiDecisionSourceService.TARGET_EDGE,
            edgeId,
            attr.getKey(),
            citedFiles,
            observedFiles,
            documentBody);
      }
    }
    attributeChangeAuditService.recordAll(events);
  }

  private static Map<String, Object> shapeForStorage(
      DataModelConfig config, DataModelTarget target, Map<String, List<String>> validated) {
    Map<String, DataModelField> byKey = new LinkedHashMap<>();
    List<DataModelField> fields =
        target == DataModelTarget.NODE ? config.nodeFields() : config.edgeFields();
    for (DataModelField field : fields) {
      byKey.put(field.key(), field);
    }
    Map<String, Object> stored = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> entry : validated.entrySet()) {
      DataModelField field = byKey.get(entry.getKey());
      Object value = AttributeValues.stored(field != null && field.multiple(), entry.getValue());
      if (value != null) {
        stored.put(entry.getKey(), value);
      }
    }
    return stored;
  }

  private static Map<String, String> auditText(Map<String, ?> values) {
    Map<String, String> text = new LinkedHashMap<>();
    for (Map.Entry<String, ?> entry : values.entrySet()) {
      String displayed = AttributeValues.display(entry.getValue());
      if (!displayed.isEmpty()) {
        text.put(entry.getKey(), displayed);
      }
    }
    return text;
  }

  /**
   * Validates LLM {@code node_refs} against automatic NODE_REF fields, resolves catalogue values to
   * existing {@code :DataModelRef} ids, and replaces {@code CLASSIFIED_AS} links. Never creates
   * catalogue nodes. Soft-fails independently of edges.
   */
  private void persistNodeRefs(
      String applicationId,
      String repositoryName,
      DiscoveryResult discovery,
      DataModelConfig dataModelConfig,
      String documentBody) {
    Map<String, List<String>> rawRefs = discovery.payload().getNodeRefs();
    if (!dataModelConfig.hasAutomaticNodeRefFields()) {
      if (!rawRefs.isEmpty()) {
        log.debug(
            "Ignoring node_refs from LLM (no automatic NODE_REF Data Model fields) keys={}",
            rawRefs.keySet());
      }
      return;
    }

    var validation = dataModelAttributeResolver.validateNodeRefs(dataModelConfig, rawRefs);
    if (!validation.accepted()) {
      log.warn(
          "Skipping Application NODE_REF enrichment applicationId={} reason={} detail={} (edges unaffected)",
          applicationId,
          validation.skipReason(),
          validation.skipDetail());
      return;
    }

    Map<String, List<String>> byFieldKey = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> entry : validation.refs().entrySet()) {
      String fieldKey = entry.getKey();
      Map<String, String> valueToId =
          nodeRefLinkWriter.resolveActiveRefIdsByValue(fieldKey, Set.copyOf(entry.getValue()));
      List<String> refIds = new ArrayList<>();
      for (String value : entry.getValue()) {
        String id = findIgnoreCase(valueToId, value);
        if (id == null) {
          log.info(
              "NODE_REF catalogue miss (no active DataModelRef) applicationId={} fieldKey={} value={}",
              applicationId,
              fieldKey,
              value);
          continue;
        }
        refIds.add(id);
      }
      byFieldKey.put(fieldKey, refIds);
    }

    if (byFieldKey.isEmpty()) {
      log.debug("No validated node_refs to persist applicationId={}", applicationId);
      return;
    }
    List<String> citedFiles = discovery.payload().getNodeSourceFiles();
    List<String> observedFiles = discovery.observedFiles();
    if (documentBody != null) {
      citedFiles = DocumentExcerpt.matching(documentBody, citedFiles);
      if (citedFiles.isEmpty()) {
        log.warn(
            "Skipping Application NODE_REF enrichment applicationId={} reason=evidence_absente (edges unaffected)",
            applicationId);
        return;
      }
      observedFiles = citedFiles;
    }

    Map<String, List<ApplicationNodeRefLinkReader.RefSummary>> current =
        nodeRefLinkReader.read(applicationId);
    if (current == null) {
      current = Map.of();
    }
    for (Map.Entry<String, List<String>> entry : byFieldKey.entrySet()) {
      List<String> previousIds =
          current.getOrDefault(entry.getKey(), List.of()).stream()
              .map(ApplicationNodeRefLinkReader.RefSummary::id)
              .sorted()
              .toList();
      List<String> nextIds = entry.getValue().stream().sorted().distinct().toList();
      if (!previousIds.equals(nextIds)) {
        traceEvidence(
            repositoryName,
            AiDecisionSourceService.KIND_NODE_PROPERTY,
            AiDecisionSourceService.TARGET_APPLICATION,
            applicationId,
            entry.getKey(),
            citedFiles,
            observedFiles,
            documentBody);
      }
    }

    nodeRefLinkWriter.replaceLinks(applicationId, byFieldKey);
    log.debug(
        "Application NODE_REF links written applicationId={} fields={}",
        applicationId,
        byFieldKey.keySet());
  }

  private void traceEvidence(
      String repositoryName,
      String decisionKind,
      String targetType,
      String targetId,
      String fieldKey,
      List<String> citedFiles,
      List<String> observedFiles,
      String documentBody) {
    if (documentBody != null) {
      decisionSources.recordQuoted(
          new AiDecisionSourceService.Decision(
              AiDecisionSourceService.PIPELINE_CONNECTION,
              decisionKind,
              targetType,
              targetId,
              fieldKey,
              repositoryName,
              citedFiles,
              citedFiles));
      return;
    }
    trace(
        repositoryName,
        decisionKind,
        targetType,
        targetId,
        fieldKey,
        citedFiles,
        observedFiles);
  }

  private void trace(
      String repositoryName,
      String decisionKind,
      String targetType,
      String targetId,
      String fieldKey,
      List<String> citedFiles,
      List<String> observedFiles) {
    decisionSources.record(
        new AiDecisionSourceService.Decision(
            AiDecisionSourceService.PIPELINE_CONNECTION,
            decisionKind,
            targetType,
            targetId,
            fieldKey,
            repositoryName,
            citedFiles,
            observedFiles));
  }

  private static String findIgnoreCase(Map<String, String> valueToId, String value) {
    if (valueToId.containsKey(value)) {
      return valueToId.get(value);
    }
    for (Map.Entry<String, String> e : valueToId.entrySet()) {
      if (e.getKey().equalsIgnoreCase(value)) {
        return e.getValue();
      }
    }
    return null;
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
