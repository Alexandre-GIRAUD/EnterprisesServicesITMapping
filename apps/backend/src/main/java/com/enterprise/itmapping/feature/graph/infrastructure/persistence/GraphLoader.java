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

  private final Neo4jClient neo4jClient;

  public GraphLoader(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public List<GraphNodeRow> loadNodesValidAt(Instant validAt) {
    return neo4jClient
        .query(NODES_CYPHER)
        .bind(Neo4jTemporalParameters.toNeo4j(validAt))
        .to("validAt")
        .fetch()
        .all()
        .stream()
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
    return neo4jClient
        .query(EDGES_CYPHER)
        .bind(Neo4jTemporalParameters.toNeo4j(validAt))
        .to("validAt")
        .fetch()
        .all()
        .stream()
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
