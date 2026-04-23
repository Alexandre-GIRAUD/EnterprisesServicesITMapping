package com.enterprise.itmapping.feature.applications.infrastructure.persistence;

import com.enterprise.itmapping.common.Neo4jTemporalParameters;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphNodeRow;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeProjection;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.Neo4jValueMapping;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Repository;

/**
 * Loads Application + Module subgraph via {@link Neo4jClient} (scalar projections only).
 *
 * <p>404 vs empty: {@link #applicationExistsValidAt(String, Instant)} distinguishes unknown /
 * inactive application from a valid root with no modules (caller returns 404 or builds graph with
 * root only).
 */
@Repository
public class ModuleGraphLoader {

  private static final String EXISTS_CYPHER =
      """
      MATCH (a:Application)
      WHERE a.id = $appId
        AND (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
      RETURN count(a) AS cnt
      """;

  private final Neo4jClient neo4jClient;
  private final int maxDepth;

  public ModuleGraphLoader(
      Neo4jClient neo4jClient,
      @Value("${app.module-graph.max-depth:10}") int maxDepth) {
    this.neo4jClient = neo4jClient;
    this.maxDepth = Math.min(Math.max(maxDepth, 1), 50);
  }

  public boolean applicationExistsValidAt(String applicationId, Instant validAt) {
    Long cnt =
        neo4jClient
            .query(EXISTS_CYPHER)
            .bind(applicationId).to("appId")
            .bind(Neo4jTemporalParameters.toNeo4j(validAt)).to("validAt")
            .fetch()
            .first()
            .map(
                row -> {
                  Object v = Neo4jValueMapping.asMap(row).get("cnt");
                  return v instanceof Number n ? n.longValue() : 0L;
                })
            .orElse(0L);
    return cnt > 0;
  }

  public List<ModuleGraphNodeRow> loadNodes(String applicationId, Instant validAt) {
    String nodesCypher = buildNodesCypher();
    return neo4jClient
        .query(nodesCypher)
        .bind(applicationId).to("appId")
        .bind(Neo4jTemporalParameters.toNeo4j(validAt)).to("validAt")
        .fetch()
        .all()
        .stream()
        .map(Neo4jValueMapping::asMap)
        .map(ModuleGraphLoader::mapNodeRow)
        .toList();
  }

  private String buildNodesCypher() {
    int d = maxDepth;
    return """
        MATCH (a:Application)
        WHERE a.id = $appId
          AND (a.validFrom IS NULL OR a.validFrom <= $validAt)
          AND (a.validTo IS NULL OR a.validTo > $validAt)
        RETURN a.id AS id, a.name AS name, a.description AS description, a.validFrom AS validFrom, a.validTo AS validTo, 'Application' AS nodeType
        UNION
        MATCH (a:Application)
        WHERE a.id = $appId
          AND (a.validFrom IS NULL OR a.validFrom <= $validAt)
          AND (a.validTo IS NULL OR a.validTo > $validAt)
        MATCH path = (a)-[:CONTAINS*1.."""
        + d
        + """
        ]->(m:Module)
        WHERE ALL(rel IN relationships(path)
          WHERE (rel.validFrom IS NULL OR rel.validFrom <= $validAt)
            AND (rel.validTo IS NULL OR rel.validTo > $validAt))
          AND ALL(z IN nodes(path)
            WHERE z = a
              OR ((z:Module)
                AND (z.validFrom IS NULL OR z.validFrom <= $validAt)
                AND (z.validTo IS NULL OR z.validTo > $validAt)))
        RETURN DISTINCT m.id AS id, m.name AS name, m.description AS description, m.validFrom AS validFrom, m.validTo AS validTo, 'Module' AS nodeType
        """;
  }

  private static ModuleGraphNodeRow mapNodeRow(Map<String, Object> map) {
    return new ModuleGraphNodeRow(
        Neo4jValueMapping.asString(map.get("id")),
        Neo4jValueMapping.asString(map.get("name")),
        Neo4jValueMapping.asString(map.get("description")),
        Neo4jValueMapping.asInstant(map.get("validFrom")),
        Neo4jValueMapping.asInstant(map.get("validTo")),
        Neo4jValueMapping.asString(map.get("nodeType")));
  }

  public List<GraphEdgeProjection> loadEdges(String applicationId, Instant validAt) {
    String edgesCypher = buildEdgesCypher();
    return neo4jClient
        .query(edgesCypher)
        .bind(applicationId).to("appId")
        .bind(Neo4jTemporalParameters.toNeo4j(validAt)).to("validAt")
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

  private String buildEdgesCypher() {
    int d = maxDepth;
    return """
        MATCH (a:Application)
        WHERE a.id = $appId
          AND (a.validFrom IS NULL OR a.validFrom <= $validAt)
          AND (a.validTo IS NULL OR a.validTo > $validAt)
        MATCH path = (a)-[:CONTAINS*1.."""
        + d
        + """
        ]->(m:Module)
        WHERE ALL(rel IN relationships(path)
          WHERE (rel.validFrom IS NULL OR rel.validFrom <= $validAt)
            AND (rel.validTo IS NULL OR rel.validTo > $validAt))
          AND ALL(z IN nodes(path)
            WHERE z = a
              OR ((z:Module)
                AND (z.validFrom IS NULL OR z.validFrom <= $validAt)
                AND (z.validTo IS NULL OR z.validTo > $validAt)))
        UNWIND relationships(path) AS r
        RETURN DISTINCT startNode(r).id AS sourceId, endNode(r).id AS targetId, type(r) AS relType
        """;
  }
}
