package com.enterprise.itmapping.feature.applications.application;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Persists application-to-application {@code DEPENDS_ON} edges discovered by the connection agent.
 *
 * <p><strong>Orientation</strong> is decided by the caller: {@code sourceId}/{@code targetId} are
 * the actual Neo4j endpoints (already resolved from the analyzed-app perspective + direction).
 *
 * <p><strong>Idempotence</strong>: the dedup key is {@code (sourceId, targetId, connection_kind,
 * channel)}.
 *
 * <ul>
 *   <li>An identical edge (same endpoints, kind and channel) → {@link Outcome#DUPLICATE}.
 *   <li>An existing bare {@code DEPENDS_ON} between the same endpoints (no {@code connection_kind}
 *       and no {@code channel}) is enriched in place → {@link Outcome#MERGED}.
 *   <li>Otherwise a new edge is created → {@link Outcome#CREATED}.
 * </ul>
 *
 * <p>Technical integration kind is stored as {@code r.connection_kind}. User-defined Data Model
 * attributes are stored as dynamic relationship properties {@code r.<field_key>}. Legacy semantic
 * {@code r.data} is not written by this writer.
 */
@Component
public class ApplicationConnectionEdgeWriter {

  private static final Logger log = LoggerFactory.getLogger(ApplicationConnectionEdgeWriter.class);

  private final Neo4jClient neo4jClient;

  public ApplicationConnectionEdgeWriter(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public enum Outcome {
    CREATED,
    MERGED,
    DUPLICATE
  }

  public record WriteResult(Outcome outcome, String edgeId) {}

  /**
   * Creates, merges or skips a {@code DEPENDS_ON} edge from {@code sourceId} to {@code targetId}.
   *
   * @param connectionKind normalized integration kind (e.g. {@code API}, {@code KAFKA}); stored as
   *     {@code r.connection_kind}.
   * @param channel technical channel (topic/queue/path/base-url); may be empty.
   * @param directionPerspective analyzed-app perspective ({@code outbound}/{@code inbound}); stored
   *     as {@code r.direction}.
   * @param dataModelAttributes whitelisted dynamic properties from the active Data Model.
   * @param allowedDataModelKeys keys permitted on the relationship (from Data Model config).
   */
  public WriteResult createOrMerge(
      String sourceId,
      String targetId,
      String connectionKind,
      String channel,
      String directionPerspective,
      String confidence,
      String discoveredFromApplicationId,
      Map<String, String> dataModelAttributes,
      Set<String> allowedDataModelKeys) {

    String normalizedKind = connectionKind != null ? connectionKind.trim() : "";
    String normalizedChannel = channel != null ? channel.trim() : "";
    Map<String, String> dynamicProps =
        filterDynamicProps(dataModelAttributes, allowedDataModelKeys);

    Optional<String> duplicate =
        findDuplicate(sourceId, targetId, normalizedKind, normalizedChannel);
    if (duplicate.isPresent()) {
      return new WriteResult(Outcome.DUPLICATE, duplicate.get());
    }

    Optional<String> merged =
        mergeIntoBareEdge(
            sourceId,
            targetId,
            normalizedKind,
            normalizedChannel,
            directionPerspective,
            confidence,
            discoveredFromApplicationId,
            dynamicProps);
    if (merged.isPresent()) {
      log.debug(
          "Connection edge merged source={} target={} connection_kind={} channel={}",
          sourceId,
          targetId,
          normalizedKind,
          normalizedChannel);
      return new WriteResult(Outcome.MERGED, merged.get());
    }

    String edgeId = UUID.randomUUID().toString();
    Map<String, Object> params = new HashMap<>();
    params.put("s", sourceId);
    params.put("t", targetId);
    params.put("edgeId", edgeId);
    params.put("kind", normalizedKind);
    params.put("channel", normalizedChannel);
    params.put("dir", directionPerspective);
    params.put("conf", confidence);
    params.put("from", discoveredFromApplicationId);
    params.put("dynamicProps", dynamicProps);

    neo4jClient
        .query(
            """
            MATCH (s:Application {id: $s})
            MATCH (t:Application {id: $t})
            CREATE (s)-[r:DEPENDS_ON {
              id: $edgeId,
              connection_kind: $kind,
              channel: $channel,
              direction: $dir,
              confidence: $conf,
              discovered_from_application_id: $from
            }]->(t)
            SET r += $dynamicProps
            """)
        .bindAll(params)
        .run();
    log.debug(
        "Connection edge created id={} source={} target={} connection_kind={} channel={} dataModelProps={}",
        edgeId,
        sourceId,
        targetId,
        normalizedKind,
        normalizedChannel,
        dynamicProps.keySet());
    return new WriteResult(Outcome.CREATED, edgeId);
  }

  private static Map<String, String> filterDynamicProps(
      Map<String, String> dataModelAttributes, Set<String> allowedDataModelKeys) {
    if (dataModelAttributes == null
        || dataModelAttributes.isEmpty()
        || allowedDataModelKeys == null
        || allowedDataModelKeys.isEmpty()) {
      return Map.of();
    }
    Map<String, String> out = new LinkedHashMap<>();
    for (Map.Entry<String, String> entry : dataModelAttributes.entrySet()) {
      String key = entry.getKey();
      String value = entry.getValue();
      if (!StringUtils.hasText(key) || !StringUtils.hasText(value)) {
        continue;
      }
      if (allowedDataModelKeys.contains(key)) {
        out.put(key, value.trim());
      }
    }
    return out;
  }

  private Optional<String> findDuplicate(
      String sourceId, String targetId, String kind, String channel) {
    Map<String, Object> params = new HashMap<>();
    params.put("s", sourceId);
    params.put("t", targetId);
    params.put("kind", kind);
    params.put("channel", channel);
    return neo4jClient
        .query(
            """
            MATCH (s:Application {id: $s})-[r:DEPENDS_ON]->(t:Application {id: $t})
            WHERE coalesce(r.connection_kind, '') = $kind
              AND coalesce(r.channel, '') = $channel
            RETURN coalesce(r.id, '') AS id
            LIMIT 1
            """)
        .bindAll(params)
        .fetch()
        .first()
        .map(row -> stringOrGenerated(row.get("id")));
  }

  private Optional<String> mergeIntoBareEdge(
      String sourceId,
      String targetId,
      String kind,
      String channel,
      String directionPerspective,
      String confidence,
      String discoveredFromApplicationId,
      Map<String, String> dynamicProps) {
    Map<String, Object> params = new HashMap<>();
    params.put("s", sourceId);
    params.put("t", targetId);
    params.put("kind", kind);
    params.put("channel", channel);
    params.put("dir", directionPerspective);
    params.put("conf", confidence);
    params.put("from", discoveredFromApplicationId);
    params.put("edgeId", UUID.randomUUID().toString());

    String mergeCypher =
        """
        MATCH (s:Application {id: $s})-[r:DEPENDS_ON]->(t:Application {id: $t})
        WHERE (r.connection_kind IS NULL OR r.connection_kind = '')
          AND (r.channel IS NULL OR r.channel = '')
        WITH r LIMIT 1
        SET r.connection_kind = $kind,
            r.channel = $channel,
            r.direction = $dir,
            r.confidence = $conf,
            r.discovered_from_application_id = $from,
            r.id = coalesce(r.id, $edgeId)
        """
            + mergeDynamicPropsClause(dynamicProps, params)
            + "\nRETURN coalesce(r.id, '') AS id";

    return neo4jClient
        .query(mergeCypher)
        .bindAll(params)
        .fetch()
        .first()
        .map(row -> stringOrGenerated(row.get("id")));
  }

  /** Enriches empty Data Model properties only (coalesce per key). */
  private static String mergeDynamicPropsClause(
      Map<String, String> dynamicProps, Map<String, Object> params) {
    if (dynamicProps == null || dynamicProps.isEmpty()) {
      return "";
    }
    StringBuilder sb = new StringBuilder();
    for (Map.Entry<String, String> entry : dynamicProps.entrySet()) {
      String key = entry.getKey();
      String param = "dm_" + key;
      params.put(param, entry.getValue());
      sb.append(", r.`").append(key).append("` = coalesce(r.`").append(key).append("`, $").append(param).append(')');
    }
    return sb.toString();
  }

  private static String stringOrGenerated(Object value) {
    if (value == null) {
      return UUID.randomUUID().toString();
    }
    String s = String.valueOf(value);
    return s.isBlank() ? UUID.randomUUID().toString() : s;
  }
}
