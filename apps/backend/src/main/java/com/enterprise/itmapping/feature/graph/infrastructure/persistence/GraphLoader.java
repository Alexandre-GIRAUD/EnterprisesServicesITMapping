package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import com.enterprise.itmapping.feature.graph.application.GraphEdgeProjection;
import com.enterprise.itmapping.feature.graph.application.GraphNodeRow;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Repository;

/**
 * Loads graph structure via Neo4jClient (no Spring Data entity hydration).
 *
 * <p>Filtering is applied per dimension (year / application ids / business unit ids / region codes);
 * active dimensions combine with AND. {@code null}/empty dimension = no filter on that axis.
 */
@Repository
public class GraphLoader {

  private static final String NODES_CYPHER_FILTERED = """
      MATCH (a:Application)
      WHERE ($filterYear = false OR a.year = $year)
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
      RETURN a.id AS id, a.name AS name, a.description AS description, a.year AS year
      """;

  private static final String EDGES_CYPHER_FILTERED = """
      MATCH (a:Application)
      WHERE ($filterYear = false OR a.year = $year)
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
      RETURN x.id AS sourceId, y.id AS targetId, type(r) AS relType, r.data AS data, r.id AS relId,
             properties(r) AS props
      """;

  private final Neo4jClient neo4jClient;

  public GraphLoader(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public List<GraphNodeRow> loadNodes(Integer year) {
    return loadNodes(year, null, null, null);
  }

  /**
   * @param year when non-null, only applications with {@code a.year = year}.
   * @param applicationIds when non-empty, only these application ids (OR).
   * @param businessUnitIds when non-empty, apps linked to any listed BU (OR).
   * @param regionCodes when non-empty, apps used in any listed region code (OR). Codes uppercased.
   *     Dimensions combine with AND when multiple are active.
   */
  public List<GraphNodeRow> loadNodes(
      Integer year,
      List<String> applicationIds,
      List<String> businessUnitIds,
      List<String> regionCodes) {
    return neo4jClient
        .query(NODES_CYPHER_FILTERED)
        .bind(year != null)
        .to("filterYear")
        .bind(year != null ? year : -1)
        .to("year")
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
        Neo4jValueMapping.asInteger(map.get("year")));
  }

  public List<GraphEdgeProjection> loadEdges(Integer year) {
    return loadEdges(year, null, null, null);
  }

  public List<GraphEdgeProjection> loadEdges(
      Integer year,
      List<String> applicationIds,
      List<String> businessUnitIds,
      List<String> regionCodes) {
    return neo4jClient
        .query(EDGES_CYPHER_FILTERED)
        .bind(year != null)
        .to("filterYear")
        .bind(year != null ? year : -1)
        .to("year")
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
                    Neo4jValueMapping.asString(map.get("relType")),
                    Neo4jValueMapping.asString(map.get("data")),
                    Neo4jValueMapping.asString(map.get("relId")),
                    colorableEdgeProperties(map.get("props"))))
        .toList();
  }

  /** Neo4j relationship props minus temporal/internal keys, stringified for the API. */
  private static Map<String, String> colorableEdgeProperties(Object raw) {
    if (!(raw instanceof Map<?, ?> map)) {
      return Map.of();
    }
    Map<String, String> out = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      String key = String.valueOf(entry.getKey());
      if ("validFrom".equals(key) || "validTo".equals(key)) {
        continue;
      }
      String value = Neo4jValueMapping.asString(entry.getValue());
      if (value != null && !value.isBlank()) {
        out.put(key, value);
      }
    }
    return out;
  }

  private static boolean hasFilter(List<String> values) {
    return values != null && !values.isEmpty();
  }
}
