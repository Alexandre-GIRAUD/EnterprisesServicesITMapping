package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import com.enterprise.itmapping.feature.workspace.infrastructure.WorkspaceGraph;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

/**
 * Reads the distinct values currently stored for one dynamic {@code DEPENDS_ON} property.
 *
 * <p>The property key becomes a Cypher identifier, so callers MUST pass a key already validated
 * against the Data Model ({@code target=EDGE}).
 */
@Repository
public class DependsOnEdgeAttributeFacetQuery {

  private final WorkspaceGraph graph;

  public DependsOnEdgeAttributeFacetQuery(WorkspaceGraph graph) {
    this.graph = graph;
  }

  public List<String> distinctValues(String validatedKey) {
    String cypher =
        AttributePropertyCypher.distinctValues(
            "MATCH (:Application {workspaceId: $workspaceId})-[r:DEPENDS_ON]->(:Application {workspaceId: $workspaceId})", "r", validatedKey);

    return graph.query(cypher).fetch().all().stream()
        .map(Neo4jValueMapping::asMap)
        .map(this::asValue)
        .filter(value -> value != null && !value.isBlank())
        .toList();
  }

  public boolean hasBlank(String validatedKey) {
    String cypher =
        """
        MATCH (:Application {workspaceId: $workspaceId})-[r:DEPENDS_ON]->(:Application {workspaceId: $workspaceId})
        WHERE r.`%s` IS NULL OR trim(toString(r.`%s`)) = ''
        RETURN r LIMIT 1
        """
            .formatted(validatedKey, validatedKey);
    return !graph.query(cypher).fetch().all().isEmpty();
  }

  private String asValue(Map<String, Object> row) {
    return Neo4jValueMapping.asString(row.get("value"));
  }
}
