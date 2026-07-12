package com.enterprise.itmapping.feature.applications.application;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Persists application-to-application {@code DEPENDS_ON} edges discovered by the connection agent.
 *
 * <p><strong>Orientation</strong> is decided by the caller: {@code sourceId}/{@code targetId} are
 * the actual Neo4j endpoints (already resolved from the analyzed-app perspective + direction).
 *
 * <p><strong>Idempotence</strong>: the dedup key is {@code (sourceId, targetId, data, channel)}.
 *
 * <ul>
 *   <li>An identical edge (same endpoints, kind and channel) → {@link Outcome#DUPLICATE}.
 *   <li>An existing bare {@code DEPENDS_ON} between the same endpoints (no {@code data} and no
 *       {@code channel}) is enriched in place → {@link Outcome#MERGED}.
 *   <li>Otherwise a new edge is created → {@link Outcome#CREATED}.
 * </ul>
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
   * @param kind normalized connection kind (e.g. {@code API}, {@code KAFKA}); stored as {@code
   *     r.data}.
   * @param channel technical channel (topic/queue/path/base-url); may be empty.
   * @param directionPerspective analyzed-app perspective ({@code outbound}/{@code inbound}); stored
   *     as {@code r.direction}.
   */
  public WriteResult createOrMerge(
      String sourceId,
      String targetId,
      String kind,
      String channel,
      String directionPerspective,
      String confidence,
      String discoveredFromApplicationId) {

    String normalizedKind = kind != null ? kind.trim() : "";
    String normalizedChannel = channel != null ? channel.trim() : "";

    Optional<String> duplicate = findDuplicate(sourceId, targetId, normalizedKind, normalizedChannel);
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
            discoveredFromApplicationId);
    if (merged.isPresent()) {
      log.debug(
          "Connection edge merged source={} target={} kind={} channel={}",
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
    neo4jClient
        .query(
            """
            MATCH (s:Application {id: $s})
            MATCH (t:Application {id: $t})
            CREATE (s)-[r:DEPENDS_ON {
              id: $edgeId,
              data: $kind,
              channel: $channel,
              direction: $dir,
              confidence: $conf,
              discovered_from_application_id: $from
            }]->(t)
            """)
        .bindAll(params)
        .run();
    log.debug(
        "Connection edge created id={} source={} target={} kind={} channel={}",
        edgeId,
        sourceId,
        targetId,
        normalizedKind,
        normalizedChannel);
    return new WriteResult(Outcome.CREATED, edgeId);
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
            WHERE coalesce(r.data, '') = $kind AND coalesce(r.channel, '') = $channel
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
      String discoveredFromApplicationId) {
    Map<String, Object> params = new HashMap<>();
    params.put("s", sourceId);
    params.put("t", targetId);
    params.put("kind", kind);
    params.put("channel", channel);
    params.put("dir", directionPerspective);
    params.put("conf", confidence);
    params.put("from", discoveredFromApplicationId);
    params.put("edgeId", UUID.randomUUID().toString());
    return neo4jClient
        .query(
            """
            MATCH (s:Application {id: $s})-[r:DEPENDS_ON]->(t:Application {id: $t})
            WHERE (r.data IS NULL OR r.data = '') AND (r.channel IS NULL OR r.channel = '')
            WITH r LIMIT 1
            SET r.data = $kind,
                r.channel = $channel,
                r.direction = $dir,
                r.confidence = $conf,
                r.discovered_from_application_id = $from,
                r.id = coalesce(r.id, $edgeId)
            RETURN coalesce(r.id, '') AS id
            """)
        .bindAll(params)
        .fetch()
        .first()
        .map(row -> stringOrGenerated(row.get("id")));
  }

  private static String stringOrGenerated(Object value) {
    if (value == null) {
      return UUID.randomUUID().toString();
    }
    String s = String.valueOf(value);
    return s.isBlank() ? UUID.randomUUID().toString() : s;
  }
}
