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

  private static final String NODES_CYPHER_FILTERED = """
      MATCH (a:Application)
      WHERE (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
        AND ($filterApplicationIds = false OR a.id IN $applicationIds)
        AND ($filterBusinessUnitIds = false OR EXISTS {
          MATCH (bu:BusinessUnit)-[:HAS_APPLICATION]->(a)
          WHERE bu.id IN $businessUnitIds
        })
        AND ($filterRegionCodes = false OR EXISTS {
          MATCH (a)-[:IS_USED_IN]->(reg:Region)
          WHERE toUpper(reg.code) IN $regionCodes
        })
      WITH DISTINCT a ORDER BY a.name
      RETURN a.id AS id, a.name AS name, a.description AS description, a.validFrom AS validFrom, a.validTo AS validTo
      """;

  private static final String EDGES_CYPHER_FILTERED = """
      MATCH (a:Application)
      WHERE (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
        AND ($filterApplicationIds = false OR a.id IN $applicationIds)
        AND ($filterBusinessUnitIds = false OR EXISTS {
          MATCH (bu:BusinessUnit)-[:HAS_APPLICATION]->(a)
          WHERE bu.id IN $businessUnitIds
        })
        AND ($filterRegionCodes = false OR EXISTS {
          MATCH (a)-[:IS_USED_IN]->(reg:Region)
          WHERE toUpper(reg.code) IN $regionCodes
        })
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
    return loadNodesValidAt(validAt, null, null, null);
  }

  /**
   * @param applicationIds when non-empty, only these application ids (OR).
   * @param businessUnitIds when non-empty, apps linked to any listed BU (OR).
   * @param regionCodes when non-empty, apps used in any listed region code (OR). Codes uppercased.
   *     Dimensions combine with AND when multiple are active.
   */
  public List<GraphNodeRow> loadNodesValidAt(
      Instant validAt,
      List<String> applicationIds,
      List<String> businessUnitIds,
      List<String> regionCodes) {
    return neo4jClient
        .query(NODES_CYPHER_FILTERED)
        .bind(Neo4jTemporalParameters.toNeo4j(validAt))
        .to("validAt")
        .bind(hasFilter(applicationIds))
        .to("filterApplicationIds")
        .bind(hasFilter(businessUnitIds))
        .to("filterBusinessUnitIds")
        .bind(hasFilter(regionCodes))
        .to("filterRegionCodes")
        .bind(hasFilter(applicationIds) ? applicationIds : List.of("__none__"))
        .to("applicationIds")
        .bind(hasFilter(businessUnitIds) ? businessUnitIds : List.of("__none__"))
        .to("businessUnitIds")
        .bind(hasFilter(regionCodes) ? regionCodes : List.of("__none__"))
        .to("regionCodes")
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
    return loadEdges(validAt, null, null, null);
  }

  public List<GraphEdgeProjection> loadEdges(
      Instant validAt,
      List<String> applicationIds,
      List<String> businessUnitIds,
      List<String> regionCodes) {
    return neo4jClient
        .query(EDGES_CYPHER_FILTERED)
        .bind(Neo4jTemporalParameters.toNeo4j(validAt))
        .to("validAt")
        .bind(hasFilter(applicationIds))
        .to("filterApplicationIds")
        .bind(hasFilter(businessUnitIds))
        .to("filterBusinessUnitIds")
        .bind(hasFilter(regionCodes))
        .to("filterRegionCodes")
        .bind(hasFilter(applicationIds) ? applicationIds : List.of("__none__"))
        .to("applicationIds")
        .bind(hasFilter(businessUnitIds) ? businessUnitIds : List.of("__none__"))
        .to("businessUnitIds")
        .bind(hasFilter(regionCodes) ? regionCodes : List.of("__none__"))
        .to("regionCodes")
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

  private static boolean hasFilter(List<String> values) {
    return values != null && !values.isEmpty();
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
