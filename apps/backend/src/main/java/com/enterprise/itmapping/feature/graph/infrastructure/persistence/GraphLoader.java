package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import com.enterprise.itmapping.feature.graph.application.GraphEdgeProjection;
import com.enterprise.itmapping.feature.graph.application.GraphNodeRow;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Repository;

/**
 * Loads graph structure via Neo4jClient (no Spring Data entity hydration).
 *
 * <p>Filtering axes: application ids, Data Model {@code NODE} flat props ({@code attr.*}), Data
 * Model {@code NODE_REF} catalogue links ({@code ref.*} → {@code CLASSIFIED_AS}), and Data Model
 * {@code EDGE} props on {@code DEPENDS_ON} ({@code edge.*}). Edge filters reduce edges only
 * (Option A: isolated applications from the node filter set are kept).
 */
@Repository
public class GraphLoader {

  private static final Logger log = LoggerFactory.getLogger(GraphLoader.class);

  private static final Set<String> NON_BUSINESS_NODE_KEYS =
      Set.of("id", "name", "description", "year", "validFrom", "validTo");

  private static final String NODE_MATCH_AND_FILTER =
      """
      MATCH (a:Application)
      WHERE ($filterApplicationIds = false OR a.id IN $applicationIds)
      """;

  private static final String NODES_RETURN =
      """
      WITH DISTINCT a ORDER BY a.name
      RETURN a.id AS id, a.name AS name, a.description AS description, properties(a) AS props
      """;

  private static final String EDGES_MATCH_PREFIX =
      """
      WITH collect(DISTINCT a.id) AS appIds
      MATCH (x:Application)-[r:DEPENDS_ON]->(y:Application)
      WHERE x.id IN appIds AND y.id IN appIds
      """;

  private static final String EDGES_RETURN =
      """
      RETURN x.id AS sourceId, y.id AS targetId, type(r) AS relType, r.data AS data, r.id AS relId,
             properties(r) AS props
      """;

  private final Neo4jClient neo4jClient;

  public GraphLoader(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public List<GraphNodeRow> loadNodes() {
    return loadNodes(null, Map.of(), Map.of());
  }

  public List<GraphNodeRow> loadNodes(
      List<String> applicationIds, Map<String, List<String>> nodeAttributeFilters) {
    return loadNodes(applicationIds, nodeAttributeFilters, Map.of());
  }

  public List<GraphNodeRow> loadNodes(
      List<String> applicationIds,
      Map<String, List<String>> nodeAttributeFilters,
      Map<String, List<String>> nodeRefFilters) {
    String cypher = buildNodeCypher(nodeAttributeFilters, nodeRefFilters);
    return neo4jClient
        .query(cypher)
        .bindAll(params(applicationIds, nodeAttributeFilters, nodeRefFilters, Map.of()))
        .fetch()
        .all()
        .stream()
        .map(Neo4jValueMapping::asMap)
        .map(GraphLoader::mapNodeRow)
        .toList();
  }

  public List<GraphEdgeProjection> loadEdges() {
    return loadEdges(null, Map.of(), Map.of(), Map.of());
  }

  public List<GraphEdgeProjection> loadEdges(
      List<String> applicationIds, Map<String, List<String>> nodeAttributeFilters) {
    return loadEdges(applicationIds, nodeAttributeFilters, Map.of(), Map.of());
  }

  public List<GraphEdgeProjection> loadEdges(
      List<String> applicationIds,
      Map<String, List<String>> nodeAttributeFilters,
      Map<String, List<String>> nodeRefFilters) {
    return loadEdges(applicationIds, nodeAttributeFilters, nodeRefFilters, Map.of());
  }

  public List<GraphEdgeProjection> loadEdges(
      List<String> applicationIds,
      Map<String, List<String>> nodeAttributeFilters,
      Map<String, List<String>> nodeRefFilters,
      Map<String, List<String>> edgeAttributeFilters) {
    String cypher = buildEdgeCypher(nodeAttributeFilters, nodeRefFilters, edgeAttributeFilters);
    return neo4jClient
        .query(cypher)
        .bindAll(params(applicationIds, nodeAttributeFilters, nodeRefFilters, edgeAttributeFilters))
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
                    stringProperties(map.get("props"), Set.of("validFrom", "validTo"))))
        .toList();
  }

  private static String buildNodeCypher(
      Map<String, List<String>> nodeFilters, Map<String, List<String>> nodeRefFilters) {
    StringBuilder sb = new StringBuilder(NODE_MATCH_AND_FILTER);
    appendNodeFilters(sb, nodeFilters, nodeRefFilters);
    String cypher = sb.append(NODES_RETURN).toString();
    log.debug(
        "Graph Cypher node filters keys={} nodeRefKeys={}",
        nodeFilters != null ? nodeFilters.keySet() : Set.of(),
        nodeRefFilters != null ? nodeRefFilters.keySet() : Set.of());
    return cypher;
  }

  private static String buildEdgeCypher(
      Map<String, List<String>> nodeFilters,
      Map<String, List<String>> nodeRefFilters,
      Map<String, List<String>> edgeFilters) {
    StringBuilder sb = new StringBuilder(NODE_MATCH_AND_FILTER);
    appendNodeFilters(sb, nodeFilters, nodeRefFilters);
    sb.append(EDGES_MATCH_PREFIX);
    if (edgeFilters != null) {
      for (String key : edgeFilters.keySet()) {
        sb.append("  AND toString(r.`")
            .append(key)
            .append("`) IN $")
            .append(edgeValuesParam(key))
            .append('\n');
      }
    }
    String cypher = sb.append(EDGES_RETURN).toString();
    log.debug(
        "Graph Cypher edge filters keys={} nodeRefKeys={} edgeFilterKeys={}",
        nodeFilters != null ? nodeFilters.keySet() : Set.of(),
        nodeRefFilters != null ? nodeRefFilters.keySet() : Set.of(),
        edgeFilters != null ? edgeFilters.keySet() : Set.of());
    return cypher;
  }

  private static void appendNodeFilters(
      StringBuilder sb,
      Map<String, List<String>> nodeFilters,
      Map<String, List<String>> nodeRefFilters) {
    if (nodeFilters != null) {
      for (String key : nodeFilters.keySet()) {
        sb.append("  AND toString(a.`")
            .append(key)
            .append("`) IN $")
            .append(valuesParam(key))
            .append('\n');
      }
    }
    if (nodeRefFilters != null) {
      int i = 0;
      for (String key : nodeRefFilters.keySet()) {
        String fieldParam = "nodeRefField_" + i;
        String idsParam = "nodeRefIds_" + i;
        sb.append("  AND EXISTS {\n")
            .append("    MATCH (a)-[:CLASSIFIED_AS {fieldKey: $")
            .append(fieldParam)
            .append("}]->(ref:DataModelRef)\n")
            .append("    WHERE ref.id IN $")
            .append(idsParam)
            .append('\n')
            .append("  }\n");
        i++;
      }
    }
  }

  private static Map<String, Object> params(
      List<String> applicationIds,
      Map<String, List<String>> nodeFilters,
      Map<String, List<String>> nodeRefFilters,
      Map<String, List<String>> edgeFilters) {
    boolean filterApplicationIds = applicationIds != null && !applicationIds.isEmpty();
    Map<String, Object> params = new LinkedHashMap<>();
    params.put("filterApplicationIds", filterApplicationIds);
    params.put("applicationIds", filterApplicationIds ? applicationIds : List.of("__none__"));
    if (nodeFilters != null) {
      for (Map.Entry<String, List<String>> entry : nodeFilters.entrySet()) {
        params.put(valuesParam(entry.getKey()), entry.getValue());
      }
    }
    if (nodeRefFilters != null) {
      int i = 0;
      for (Map.Entry<String, List<String>> entry : nodeRefFilters.entrySet()) {
        params.put("nodeRefField_" + i, entry.getKey());
        params.put("nodeRefIds_" + i, entry.getValue());
        i++;
      }
    }
    if (edgeFilters != null) {
      for (Map.Entry<String, List<String>> entry : edgeFilters.entrySet()) {
        params.put(edgeValuesParam(entry.getKey()), entry.getValue());
      }
    }
    return params;
  }

  private static String valuesParam(String key) {
    return "nodeAttr_" + key;
  }

  private static String edgeValuesParam(String key) {
    return "edgeAttr_" + key;
  }

  private static GraphNodeRow mapNodeRow(Map<String, Object> map) {
    return new GraphNodeRow(
        Neo4jValueMapping.asString(map.get("id")),
        Neo4jValueMapping.asString(map.get("name")),
        Neo4jValueMapping.asString(map.get("description")),
        stringProperties(map.get("props"), NON_BUSINESS_NODE_KEYS));
  }

  private static Map<String, String> stringProperties(Object raw, Set<String> excludedKeys) {
    if (!(raw instanceof Map<?, ?> map)) {
      return Map.of();
    }
    Map<String, String> out = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      String key = String.valueOf(entry.getKey());
      if (excludedKeys.contains(key)) {
        continue;
      }
      String value = Neo4jValueMapping.asString(entry.getValue());
      if (value != null && !value.isBlank()) {
        out.put(key, value);
      }
    }
    return out;
  }
}
