package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import com.enterprise.itmapping.common.Neo4jTemporalParameters;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeProjection;
import com.enterprise.itmapping.feature.graph.application.GraphNodeRow;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Repository;

/**
 * Loads graph structure via Neo4jClient (no Spring Data entity hydration).
 * Temporal values are mapped defensively (Neo4j driver may return {@link org.neo4j.driver.Value},
 * {@link java.time.ZonedDateTime}, etc.).
 */
@Repository
public class GraphLoader {

  private static final String NODES_CYPHER = """
      MATCH (a:Application)
      WHERE (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
      WITH a ORDER BY a.name
      RETURN a.id AS id, a.name AS name, a.description AS description, a.validFrom AS validFrom, a.validTo AS validTo
      """;

  /**
   * Applications linked to a BU at validAt; used to filter the Cytoscape dependency graph without
   * emitting {@code BusinessUnit} nodes in the API payload.
   */
  private static final String NODES_CYPHER_FOR_BUSINESS_UNIT = """
      MATCH (bu:BusinessUnit {id: $businessUnitId})-[:HAS_APPLICATION]->(a:Application)
      WHERE (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
      WITH a ORDER BY a.name
      RETURN a.id AS id, a.name AS name, a.description AS description, a.validFrom AS validFrom, a.validTo AS validTo
      """;

  private static final String EDGES_CYPHER = """
      MATCH (a:Application)-[r:DEPENDS_ON]->(b:Application)
      WHERE (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
        AND (b.validFrom IS NULL OR b.validFrom <= $validAt)
        AND (b.validTo IS NULL OR b.validTo > $validAt)
        AND (r.validFrom IS NULL OR r.validFrom <= $validAt)
        AND (r.validTo IS NULL OR r.validTo > $validAt)
      RETURN a.id AS sourceId, b.id AS targetId, type(r) AS relType
      """;

  /** {@code DEPENDS_ON} only when both endpoints belong to the BU's application set. */
  private static final String EDGES_CYPHER_FOR_BUSINESS_UNIT = """
      MATCH (bu:BusinessUnit {id: $businessUnitId})-[:HAS_APPLICATION]->(a:Application)
      WHERE (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
      WITH collect(DISTINCT a.id) AS appIds
      MATCH (x:Application)-[r:DEPENDS_ON]->(y:Application)
      WHERE x.id IN appIds AND y.id IN appIds
        AND (x.validFrom IS NULL OR x.validFrom <= $validAt)
        AND (x.validTo IS NULL OR x.validTo > $validAt)
        AND (y.validFrom IS NULL OR y.validFrom <= $validAt)
        AND (y.validTo IS NULL OR y.validTo > $validAt)
        AND (r.validFrom IS NULL OR r.validFrom <= $validAt)
        AND (r.validTo IS NULL OR r.validTo > $validAt)
      RETURN x.id AS sourceId, y.id AS targetId, type(r) AS relType
      """;

  private final Neo4jClient neo4jClient;

  public GraphLoader(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public List<GraphNodeRow> loadNodesValidAt(Instant validAt) {
    return loadNodesValidAt(validAt, null);
  }

  /**
   * @param businessUnitId when non-blank, only applications linked via {@code HAS_APPLICATION}
   *     from that BU are returned.
   */
  public List<GraphNodeRow> loadNodesValidAt(Instant validAt, String businessUnitId) {
    String cypher =
        businessUnitId != null && !businessUnitId.isBlank()
            ? NODES_CYPHER_FOR_BUSINESS_UNIT
            : NODES_CYPHER;
    var query = neo4jClient.query(cypher).bind(Neo4jTemporalParameters.toNeo4j(validAt)).to("validAt");
    if (businessUnitId != null && !businessUnitId.isBlank()) {
      query = query.bind(businessUnitId.trim()).to("businessUnitId");
    }
    return query.fetch().all().stream()
        .map(Neo4jValueMapping::asMap)
        .map(GraphLoader::mapNodeRow)
        .toList();
  }

  private static GraphNodeRow mapNodeRow(Map<String, Object> map) {
    return new GraphNodeRow(
        Neo4jValueMapping.asString(map.get("id")),
        Neo4jValueMapping.asString(map.get("name")),
        Neo4jValueMapping.asString(map.get("description")),
        Neo4jValueMapping.asInstant(map.get("validFrom")),
        Neo4jValueMapping.asInstant(map.get("validTo")));
  }

  public List<GraphEdgeProjection> loadEdges(Instant validAt) {
    return loadEdges(validAt, null);
  }

  public List<GraphEdgeProjection> loadEdges(Instant validAt, String businessUnitId) {
    String cypher =
        businessUnitId != null && !businessUnitId.isBlank()
            ? EDGES_CYPHER_FOR_BUSINESS_UNIT
            : EDGES_CYPHER;
    var query = neo4jClient.query(cypher).bind(Neo4jTemporalParameters.toNeo4j(validAt)).to("validAt");
    if (businessUnitId != null && !businessUnitId.isBlank()) {
      query = query.bind(businessUnitId.trim()).to("businessUnitId");
    }
    return query.fetch().all().stream()
        .map(Neo4jValueMapping::asMap)
        .map(
            map ->
                new GraphEdgeProjection(
                    Neo4jValueMapping.asString(map.get("sourceId")),
                    Neo4jValueMapping.asString(map.get("targetId")),
                    Neo4jValueMapping.asString(map.get("relType"))))
        .toList();
  }

  public int linkCurrentNodesToSnapshot(String snapshotId, Instant now) {
    String linkCypher = """
        MATCH (s:VersionSnapshot {id: $snapshotId})
        MATCH (n:Application)
        WHERE n.validTo IS NULL AND n.validFrom <= $now
        CREATE (s)-[r:VALID_DURING]->(n)
        SET r.validFrom = $now
        WITH count(r) AS cnt
        RETURN cnt
        """;
    return neo4jClient.query(linkCypher)
        .bind(snapshotId).to("snapshotId")
        .bind(Neo4jTemporalParameters.toNeo4j(now)).to("now")
        .fetch()
        .first()
        .map(
            row -> {
              Map<String, Object> map = Neo4jValueMapping.asMap(row);
              Object value = map.get("cnt");
              if (value instanceof Number number) {
                return number.intValue();
              }
              return 0;
            })
        .orElse(0);
  }
}
