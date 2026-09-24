package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto.NeighborhoodApplicationDto;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto.NeighborhoodEdgeDto;
import com.enterprise.itmapping.feature.graph.domain.NeighborhoodDirection;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.Neo4jValueMapping;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Loads incident {@code DEPENDS_ON} edges for one Application (unlike {@link GraphService#getGraph}
 * which only returns edges whose both ends are in a filtered id set).
 */
@Service
public class GraphNeighborhoodService {

  private static final Set<String> EXCLUDED_EDGE_KEYS = Set.of("validFrom", "validTo");

  private final Neo4jClient neo4jClient;

  public GraphNeighborhoodService(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  @Transactional(readOnly = true)
  public ApplicationNeighborhoodDto getNeighborhood(
      String applicationId, NeighborhoodDirection direction, int maxEdges) {
    if (!StringUtils.hasText(applicationId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "applicationId required.");
    }
    String id = applicationId.trim();
    NeighborhoodDirection dir = direction != null ? direction : NeighborhoodDirection.BOTH;
    int limit = Math.max(1, maxEdges);

    Map<String, Object> appRow =
        neo4jClient
            .query(
                """
                MATCH (a:Application {id: $id})
                RETURN a.id AS id, a.name AS name, a.description AS description
                """)
            .bind(id)
            .to("id")
            .fetch()
            .one()
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Application not found."));

    NeighborhoodApplicationDto app =
        new NeighborhoodApplicationDto(
            Neo4jValueMapping.asString(appRow.get("id")),
            Neo4jValueMapping.asString(appRow.get("name")),
            Neo4jValueMapping.asString(appRow.get("description")));

    List<NeighborhoodEdgeDto> edges = new ArrayList<>();
    if (dir == NeighborhoodDirection.BOTH || dir == NeighborhoodDirection.OUT) {
      edges.addAll(loadDirected(id, "OUT", limit + 1 - edges.size()));
    }
    if (edges.size() <= limit
        && (dir == NeighborhoodDirection.BOTH || dir == NeighborhoodDirection.IN)) {
      int remaining = limit + 1 - edges.size();
      edges.addAll(loadDirected(id, "IN", remaining));
    }

    boolean truncated = edges.size() > limit;
    if (truncated) {
      edges = List.copyOf(edges.subList(0, limit));
    }
    return new ApplicationNeighborhoodDto(app, edges, truncated);
  }

  private List<NeighborhoodEdgeDto> loadDirected(String applicationId, String direction, int limit) {
    if (limit <= 0) {
      return List.of();
    }
    String cypher =
        "OUT".equals(direction)
            ? """
              MATCH (a:Application {id: $id})-[r:DEPENDS_ON]->(b:Application)
              RETURN r.id AS edgeId, b.id AS otherId, b.name AS otherName, properties(r) AS props
              ORDER BY b.name
              LIMIT $limit
              """
            : """
              MATCH (b:Application)-[r:DEPENDS_ON]->(a:Application {id: $id})
              RETURN r.id AS edgeId, b.id AS otherId, b.name AS otherName, properties(r) AS props
              ORDER BY b.name
              LIMIT $limit
              """;

    return neo4jClient
        .query(cypher)
        .bind(applicationId)
        .to("id")
        .bind(limit)
        .to("limit")
        .fetch()
        .all()
        .stream()
        .map(Neo4jValueMapping::asMap)
        .map(
            row ->
                new NeighborhoodEdgeDto(
                    Neo4jValueMapping.asString(row.get("edgeId")),
                    direction,
                    Neo4jValueMapping.asString(row.get("otherId")),
                    Neo4jValueMapping.asString(row.get("otherName")),
                    stringProperties(row.get("props"))))
        .toList();
  }

  private static Map<String, String> stringProperties(Object raw) {
    if (!(raw instanceof Map<?, ?> map)) {
      return Map.of();
    }
    Map<String, String> out = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      String key = String.valueOf(entry.getKey());
      if (EXCLUDED_EDGE_KEYS.contains(key)) {
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
