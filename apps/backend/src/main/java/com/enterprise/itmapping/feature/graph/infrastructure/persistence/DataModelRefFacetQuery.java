package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import com.enterprise.itmapping.feature.workspace.infrastructure.WorkspaceGraph;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/** Active {@code :DataModelRef} catalogue rows for one NODE_REF field key. */
@Repository
public class DataModelRefFacetQuery {

  private final WorkspaceGraph graph;

  public DataModelRefFacetQuery(WorkspaceGraph graph) {
    this.graph = graph;
  }

  public List<RefOption> activeOptions(String fieldKey) {
    if (!StringUtils.hasText(fieldKey)) {
      return List.of();
    }
    return graph
        .query(
            """
            MATCH (r:DataModelRef {workspaceId: $workspaceId, fieldKey: $fieldKey})
            WHERE coalesce(r.active, true) = true
            RETURN r.id AS id, r.name AS name, r.value AS value
            ORDER BY r.name
            """)
        .bind(fieldKey)
        .to("fieldKey")
        .fetch()
        .all()
        .stream()
        .map(
            row ->
                new RefOption(
                    asString(row.get("id")),
                    firstNonBlank(asString(row.get("name")), asString(row.get("value")))))
        .filter(o -> StringUtils.hasText(o.id()))
        .toList();
  }

  public boolean hasUnclassified(String fieldKey) {
    if (!StringUtils.hasText(fieldKey)) {
      return false;
    }
    return !graph
        .query(
            """
            MATCH (a:Application {workspaceId: $workspaceId})
            WHERE NOT EXISTS {
              MATCH (a)-[:CLASSIFIED_AS {fieldKey: $fieldKey}]->(:DataModelRef {workspaceId: $workspaceId})
            }
            RETURN a LIMIT 1
            """)
        .bind(fieldKey)
        .to("fieldKey")
        .fetch()
        .all()
        .isEmpty();
  }

  public record RefOption(String id, String name) {}

  private static String asString(Object value) {
    return value != null ? String.valueOf(value) : "";
  }

  private static String firstNonBlank(String a, String b) {
    if (StringUtils.hasText(a)) {
      return a;
    }
    return b != null ? b : "";
  }
}
