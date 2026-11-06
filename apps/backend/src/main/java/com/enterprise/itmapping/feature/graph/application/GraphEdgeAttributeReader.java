package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.feature.datamodel.application.AttributeValues;
import com.enterprise.itmapping.feature.workspace.infrastructure.WorkspaceGraph;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Reads dynamic business properties stored on a {@code DEPENDS_ON} relationship. */
@Component
public class GraphEdgeAttributeReader {

  /** System / structural keys never treated as Data Model EDGE attributes. */
  public static final Set<String> NON_BUSINESS_KEYS =
      Set.of(
          "id",
          "connection_kind",
          "channel",
          "direction",
          "confidence",
          "discovered_from_application_id",
          "validFrom",
          "validTo");

  private final WorkspaceGraph graph;

  public GraphEdgeAttributeReader(WorkspaceGraph graph) {
    this.graph = graph;
  }

  public boolean exists(String edgeId) {
    if (!StringUtils.hasText(edgeId)) {
      return false;
    }
    return graph
        .query(
            """
            MATCH (:Application {workspaceId: $workspaceId})-[r:DEPENDS_ON {id: $id}]->()
            RETURN count(r) AS cnt
            """)
        .bind(edgeId.trim())
        .to("id")
        .fetch()
        .first()
        .map(
            row -> {
              Object cnt = row.get("cnt");
              return cnt instanceof Number n && n.longValue() > 0;
            })
        .orElse(false);
  }

  public Map<String, Object> read(String edgeId) {
    if (!StringUtils.hasText(edgeId)) {
      return Map.of();
    }
    return graph
        .query(
            """
            MATCH (:Application {workspaceId: $workspaceId})-[r:DEPENDS_ON {id: $id}]->()
            RETURN properties(r) AS props
            LIMIT 1
            """)
        .bind(edgeId.trim())
        .to("id")
        .fetch()
        .first()
        .map(row -> AttributeValues.readProperties(row.get("props"), NON_BUSINESS_KEYS))
        .orElseGet(Map::of);
  }
}
