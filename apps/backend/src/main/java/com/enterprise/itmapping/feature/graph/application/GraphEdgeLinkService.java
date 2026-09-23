package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Lifecycle audit ({@code EDGE_LINK}) and deletion of graph edges. Snapshot JSON is stored in
 * {@code attribute_change_events} so History remains readable after Neo4j delete.
 */
@Service
public class GraphEdgeLinkService {

  private static final Logger log = LoggerFactory.getLogger(GraphEdgeLinkService.class);

  public static final String LINK_FIELD_KEY = "__link__";

  private static final Set<String> SNAPSHOT_EXCLUDED_PROP_KEYS =
      Set.of("id", "validFrom", "validTo");

  private final Neo4jClient neo4jClient;
  private final AttributeChangeAuditService auditService;
  private final ObjectMapper objectMapper;

  public GraphEdgeLinkService(
      Neo4jClient neo4jClient,
      AttributeChangeAuditService auditService,
      ObjectMapper objectMapper) {
    this.neo4jClient = neo4jClient;
    this.auditService = auditService;
    this.objectMapper = objectMapper;
  }

  /** Loads a compact JSON snapshot of the edge, or empty if not found. */
  public Optional<String> loadSnapshotJson(String edgeId) {
    return loadSnapshot(edgeId).map(this::toJson);
  }

  public Optional<EdgeLinkSnapshot> loadSnapshot(String edgeId) {
    if (!StringUtils.hasText(edgeId)) {
      return Optional.empty();
    }
    return neo4jClient
        .query(
            """
            MATCH (s)-[r]->(t)
            WHERE r.id = $id
            RETURN s.id AS sourceId, t.id AS targetId, type(r) AS type, properties(r) AS props
            LIMIT 1
            """)
        .bind(edgeId.trim())
        .to("id")
        .fetch()
        .first()
        .map(this::mapSnapshot);
  }

  @Transactional
  public void recordCreateHuman(
      String edgeId, EdgeLinkSnapshot snapshot, AttributeChangeMetaDto changeMeta) {
    if (changeMeta == null || changeMeta.reason() == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "changeMeta.reason is required for human edge creation.");
    }
    auditService.record(
        AttributeChangeRequest.human(
            AuditTargetType.EDGE,
            edgeId,
            AuditFieldScope.EDGE_LINK,
            LINK_FIELD_KEY,
            null,
            toJson(snapshot),
            changeMeta.reason(),
            changeMeta.reasonComment()));
  }

  @Transactional
  public void recordCreateAi(String edgeId, EdgeLinkSnapshot snapshot, String aiSource) {
    auditService.record(
        AttributeChangeRequest.ai(
            AuditTargetType.EDGE,
            edgeId,
            AuditFieldScope.EDGE_LINK,
            LINK_FIELD_KEY,
            null,
            toJson(snapshot),
            aiSource != null ? aiSource : "AI"));
  }

  @Transactional
  public void recordCreateAiFromIds(
      String edgeId,
      String sourceId,
      String targetId,
      String type,
      Map<String, String> dataModelAttributes,
      String connectionKind,
      String channel,
      String data,
      String aiSource) {
    EdgeLinkSnapshot snapshot =
        new EdgeLinkSnapshot(
            sourceId,
            targetId,
            type,
            blankToNull(data),
            blankToNull(connectionKind),
            blankToNull(channel),
            dataModelAttributes != null ? Map.copyOf(dataModelAttributes) : Map.of());
    recordCreateAi(edgeId, snapshot, aiSource);
  }

  /**
   * Human delete: audit then Neo4j delete. Unknown id → 404. Missing reason → 400.
   */
  @Transactional
  public void deleteHuman(String edgeId, AttributeChangeMetaDto changeMeta) {
    if (changeMeta == null || changeMeta.reason() == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "changeMeta.reason is required for human edge deletion.");
    }
    delete(
        edgeId,
        changeMeta.reason(),
        changeMeta.reasonComment(),
        null);
  }

  /** AI / system delete — for future cascade; v1 may be unused. */
  @Transactional
  public void deleteAi(String edgeId, String aiSource) {
    delete(edgeId, null, null, aiSource != null ? aiSource : "API_DELETE");
  }

  private void delete(
      String edgeId,
      HumanChangeReason humanReason,
      String humanReasonComment,
      String aiSource) {
    if (!StringUtils.hasText(edgeId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Edge not found.");
    }
    EdgeLinkSnapshot snapshot =
        loadSnapshot(edgeId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Edge not found: " + edgeId));

    String snapshotJson = toJson(snapshot);
    if (humanReason != null) {
      auditService.record(
          AttributeChangeRequest.human(
              AuditTargetType.EDGE,
              edgeId.trim(),
              AuditFieldScope.EDGE_LINK,
              LINK_FIELD_KEY,
              snapshotJson,
              null,
              humanReason,
              humanReasonComment));
    } else {
      auditService.record(
          AttributeChangeRequest.ai(
              AuditTargetType.EDGE,
              edgeId.trim(),
              AuditFieldScope.EDGE_LINK,
              LINK_FIELD_KEY,
              snapshotJson,
              null,
              aiSource));
    }

    long deleted =
        neo4jClient
            .query(
                """
                MATCH ()-[r]->()
                WHERE r.id = $id
                WITH collect(r) AS rels
                FOREACH (rel IN rels | DELETE rel)
                RETURN size(rels) AS cnt
                """)
            .bind(edgeId.trim())
            .to("id")
            .fetch()
            .first()
            .map(
                row -> {
                  Object cnt = row.get("cnt");
                  return cnt instanceof Number n ? n.longValue() : 0L;
                })
            .orElse(0L);

    if (deleted == 0) {
      log.error(
          "Edge audit recorded but Neo4j delete removed 0 relationships edgeId={}", edgeId);
      throw new ResponseStatusException(
          HttpStatus.INTERNAL_SERVER_ERROR, "Failed to delete edge from graph.");
    }
    log.info("Edge deleted id={} type={} source={} target={}", edgeId, snapshot.type(), snapshot.sourceId(), snapshot.targetId());
  }

  private EdgeLinkSnapshot mapSnapshot(Map<String, Object> row) {
    String sourceId = stringVal(row.get("sourceId"));
    String targetId = stringVal(row.get("targetId"));
    String type = stringVal(row.get("type"));
    Map<String, String> props = stringProps(row.get("props"));
    String data = props.get("data");
    String kind = props.get("connection_kind");
    String channel = props.get("channel");
    Map<String, String> attributes = new LinkedHashMap<>();
    for (Map.Entry<String, String> e : props.entrySet()) {
      if (SNAPSHOT_EXCLUDED_PROP_KEYS.contains(e.getKey())
          || "data".equals(e.getKey())
          || "connection_kind".equals(e.getKey())
          || "channel".equals(e.getKey())
          || "direction".equals(e.getKey())
          || "confidence".equals(e.getKey())
          || "discovered_from_application_id".equals(e.getKey())) {
        continue;
      }
      attributes.put(e.getKey(), e.getValue());
    }
    return new EdgeLinkSnapshot(sourceId, targetId, type, data, kind, channel, Map.copyOf(attributes));
  }

  private String toJson(EdgeLinkSnapshot snapshot) {
    try {
      Map<String, Object> body = new LinkedHashMap<>();
      body.put("sourceId", snapshot.sourceId());
      body.put("targetId", snapshot.targetId());
      body.put("type", snapshot.type());
      body.put("data", snapshot.data());
      body.put("connection_kind", snapshot.connectionKind());
      body.put("channel", snapshot.channel());
      body.put("attributes", snapshot.attributes());
      return objectMapper.writeValueAsString(body);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Failed to serialize edge link snapshot", e);
    }
  }

  private static Map<String, String> stringProps(Object raw) {
    if (!(raw instanceof Map<?, ?> map)) {
      return Map.of();
    }
    Map<String, String> out = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      if (entry.getValue() == null) {
        continue;
      }
      String key = String.valueOf(entry.getKey());
      String value = String.valueOf(entry.getValue());
      if (!value.isBlank()) {
        out.put(key, value);
      }
    }
    return out;
  }

  private static String stringVal(Object raw) {
    return raw == null ? null : String.valueOf(raw);
  }

  private static String blankToNull(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }

  public record EdgeLinkSnapshot(
      String sourceId,
      String targetId,
      String type,
      String data,
      String connectionKind,
      String channel,
      Map<String, String> attributes) {}
}
