package com.enterprise.itmapping.feature.applications.application;

import java.util.HashMap;
import com.enterprise.itmapping.feature.datamodel.application.AttributeValues;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
 * <p><strong>Idempotence</strong>: two edges between the same applications are the same flow when their
 * Data Model attribute values match. {@code connection_kind}, {@code channel}, and {@code
 * confidence} are not written.
 *
 * <ul>
 *   <li>An edge with the same endpoints and the same Data Model values → {@link Outcome#DUPLICATE}.
 *   <li>An existing {@code DEPENDS_ON} that does not yet have those Data Model keys is enriched in
 *       place → {@link Outcome#MERGED}.
 *   <li>Otherwise a new edge is created → {@link Outcome#CREATED}.
 * </ul>
 *
 * <p>User-defined Data Model attributes are stored as dynamic relationship properties
 * {@code r.<field_key>}.
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
   * @param connectionKind ignored. Transport kind is not a Data Model field and is not stored.
   * @param channel ignored. Transport channel is not a Data Model field and is not stored.
   * @param directionPerspective analyzed-app perspective ({@code outbound}/{@code inbound}); stored
   *     as {@code r.direction}.
   * @param confidence ignored. Confidence is not a Data Model field and is not stored.
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
      Map<String, ?> dataModelAttributes,
      Set<String> allowedDataModelKeys) {

    Map<String, Object> dynamicProps =
        AttributeValues.whitelisted(dataModelAttributes, allowedDataModelKeys);

    Optional<String> duplicate = findDuplicate(sourceId, targetId, dynamicProps);
    if (duplicate.isPresent()) {
      return new WriteResult(Outcome.DUPLICATE, duplicate.get());
    }

    Optional<String> merged =
        mergeIntoBareEdge(
            sourceId,
            targetId,
            directionPerspective,
            discoveredFromApplicationId,
            dynamicProps);
    if (merged.isPresent()) {
      log.debug(
          "Connection edge merged source={} target={} dataModelProps={}",
          sourceId,
          targetId,
          dynamicProps.keySet());
      return new WriteResult(Outcome.MERGED, merged.get());
    }

    String edgeId = UUID.randomUUID().toString();
    Map<String, Object> params = new HashMap<>();
    params.put("s", sourceId);
    params.put("t", targetId);
    params.put("edgeId", edgeId);
    params.put("dir", directionPerspective);
    params.put("from", discoveredFromApplicationId);
    params.put("dynamicProps", dynamicProps);

    neo4jClient
        .query(
            """
            MATCH (s:Application {id: $s})
            MATCH (t:Application {id: $t})
            CREATE (s)-[r:DEPENDS_ON {
              id: $edgeId,
              direction: $dir,
              discovered_from_application_id: $from
            }]->(t)
            SET r += $dynamicProps
            """)
        .bindAll(params)
        .run();
    log.debug(
        "Connection edge created id={} source={} target={} dataModelProps={}",
        edgeId,
        sourceId,
        targetId,
        dynamicProps.keySet());
    return new WriteResult(Outcome.CREATED, edgeId);
  }

  /**
   * A flow is new when no {@code DEPENDS_ON} between the endpoints already has these Data Model
   * values, and none is waiting to be filled with them.
   */
  public boolean isNewFlow(
      String sourceId,
      String targetId,
      Map<String, ?> dataModelAttributes,
      Set<String> allowedDataModelKeys) {
    Map<String, Object> dynamicProps =
        AttributeValues.whitelisted(dataModelAttributes, allowedDataModelKeys);
    if (findDuplicate(sourceId, targetId, dynamicProps).isPresent()) {
      return false;
    }
    return findBareEdgeId(sourceId, targetId, dynamicProps.keySet()).isEmpty();
  }

  /**
   * {@code DEPENDS_ON} between the endpoints whose Data Model keys are still unset. Used before a
   * merge so the audit can snapshot the previous values.
   */
  public Optional<String> findBareEdgeId(
      String sourceId, String targetId, Set<String> attributeKeys) {
    Map<String, Object> params = new HashMap<>();
    params.put("s", sourceId);
    params.put("t", targetId);
    String cypher =
        """
        MATCH (s:Application {id: $s})-[r:DEPENDS_ON]->(t:Application {id: $t})
        WHERE true
        """
            + unsetAttributeClause(attributeKeys)
            + """

            RETURN coalesce(r.id, '') AS id
            LIMIT 1
            """;
    return neo4jClient
        .query(cypher)
        .bindAll(params)
        .fetch()
        .first()
        .map(row -> stringOrGenerated(row.get("id")));
  }

  private Optional<String> findDuplicate(
      String sourceId, String targetId, Map<String, Object> dynamicProps) {
    Map<String, Object> params = new HashMap<>();
    params.put("s", sourceId);
    params.put("t", targetId);
    return neo4jClient
        .query(
            """
            MATCH (s:Application {id: $s})-[r:DEPENDS_ON]->(t:Application {id: $t})
            RETURN coalesce(r.id, '') AS id, properties(r) AS props
            """)
        .bindAll(params)
        .fetch()
        .all()
        .stream()
        .filter(row -> sameDataModelValues(row.get("props"), dynamicProps))
        .map(row -> stringOrGenerated(row.get("id")))
        .findFirst();
  }

  /** Two edges between the same applications stay distinct when a data-model value differs. */
  private static boolean sameDataModelValues(Object storedProps, Map<String, Object> incoming) {
    Map<String, Object> incomingValues = incoming != null ? incoming : Map.of();
    Map<?, ?> stored = storedProps instanceof Map<?, ?> map ? map : Map.of();
    if (incomingValues.isEmpty()) {
      return !hasBusinessProperty(stored);
    }
    for (Map.Entry<String, Object> entry : incomingValues.entrySet()) {
      if (!String.valueOf(entry.getValue()).equals(String.valueOf(stored.get(entry.getKey())))) {
        return false;
      }
    }
    return true;
  }

  private static boolean hasBusinessProperty(Map<?, ?> stored) {
    for (Object key : stored.keySet()) {
      String name = String.valueOf(key);
      if (!"id".equals(name)
          && !"connection_kind".equals(name)
          && !"channel".equals(name)
          && !"direction".equals(name)
          && !"confidence".equals(name)
          && !"discovered_from_application_id".equals(name)
          && !"validFrom".equals(name)
          && !"validTo".equals(name)) {
        return true;
      }
    }
    return false;
  }

  private Optional<String> mergeIntoBareEdge(
      String sourceId,
      String targetId,
      String directionPerspective,
      String discoveredFromApplicationId,
      Map<String, Object> dynamicProps) {
    Map<String, Object> params = new HashMap<>();
    params.put("s", sourceId);
    params.put("t", targetId);
    params.put("dir", directionPerspective);
    params.put("from", discoveredFromApplicationId);
    params.put("edgeId", UUID.randomUUID().toString());

    String mergeCypher =
        """
        MATCH (s:Application {id: $s})-[r:DEPENDS_ON]->(t:Application {id: $t})
        WHERE true
        """
            + unsetAttributeClause(dynamicProps.keySet())
            + """

        WITH r LIMIT 1
        SET r.direction = $dir,
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

  /** Matches only edges that do not already store these Data Model keys. */
  private static String unsetAttributeClause(Set<String> attributeKeys) {
    if (attributeKeys == null || attributeKeys.isEmpty()) {
      return "";
    }
    StringBuilder sb = new StringBuilder();
    for (String key : attributeKeys) {
      if (!isSafePropertyKey(key)) {
        continue;
      }
      sb.append(" AND r.`").append(key).append("` IS NULL");
    }
    return sb.toString();
  }

  private static boolean isSafePropertyKey(String key) {
    return key != null && key.matches("[a-z][a-z0-9_]{0,63}");
  }

  /** Enriches empty Data Model properties only (coalesce per key). */
  private static String mergeDynamicPropsClause(
      Map<String, Object> dynamicProps, Map<String, Object> params) {
    if (dynamicProps == null || dynamicProps.isEmpty()) {
      return "";
    }
    StringBuilder sb = new StringBuilder();
    for (Map.Entry<String, Object> entry : dynamicProps.entrySet()) {
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
