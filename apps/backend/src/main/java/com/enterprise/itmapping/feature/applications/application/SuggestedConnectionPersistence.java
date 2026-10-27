package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.ConnectionDiscoveryAgent.DiscoveryResult;
import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload.AiConnectionEntry;
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
import com.enterprise.itmapping.feature.datamodel.application.DataModelAttributeResolver.ValidationResult;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributeReader;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeLinkService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Writes connection suggestions the discovery step already accepted. */
final class SuggestedConnectionPersistence {

  private static final Logger log = LoggerFactory.getLogger(SuggestedConnectionPersistence.class);

  private final ApplicationConnectionEdgeWriter edgeWriter;
  private final ApplicationNodeAttributePatchService nodeAttributePatchService;
  private final ApplicationNodeRefLinkWriter nodeRefLinkWriter;
  private final GraphEdgeAttributeReader edgeAttributeReader;
  private final AttributeChangeAuditService attributeChangeAuditService;
  private final GraphEdgeLinkService edgeLinkService;
  private final HumanFieldOverrideGuard overrideGuard;
  private final DataModelAttributeResolver dataModelAttributeResolver;
  private final AiDecisionSourceService decisionSources;
  private final ApplicationNodeRefLinkReader nodeRefLinkReader;

  SuggestedConnectionPersistence(
      ApplicationConnectionEdgeWriter edgeWriter,
      ApplicationNodeAttributePatchService nodeAttributePatchService,
      ApplicationNodeRefLinkWriter nodeRefLinkWriter,
      GraphEdgeAttributeReader edgeAttributeReader,
      AttributeChangeAuditService attributeChangeAuditService,
      GraphEdgeLinkService edgeLinkService,
      HumanFieldOverrideGuard overrideGuard,
      DataModelAttributeResolver dataModelAttributeResolver,
      AiDecisionSourceService decisionSources,
      ApplicationNodeRefLinkReader nodeRefLinkReader) {
    this.edgeWriter = edgeWriter;
    this.nodeAttributePatchService = nodeAttributePatchService;
    this.nodeRefLinkWriter = nodeRefLinkWriter;
    this.edgeAttributeReader = edgeAttributeReader;
    this.attributeChangeAuditService = attributeChangeAuditService;
    this.edgeLinkService = edgeLinkService;
    this.overrideGuard = overrideGuard;
    this.dataModelAttributeResolver = dataModelAttributeResolver;
    this.decisionSources = decisionSources;
    this.nodeRefLinkReader = nodeRefLinkReader;
  }

  SuggestConnectionsFromGithubResponse persist(
      String applicationId,
      String repositoryName,
      ApplicationConnectionSuggestionService.Catalog catalog,
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

      String normalizedName = ApplicationConnectionSuggestionService.normalizeName(peerName);
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
      if (!ApplicationConnectionSuggestionService.ALLOWED_DIRECTIONS.contains(direction)) {
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
}
