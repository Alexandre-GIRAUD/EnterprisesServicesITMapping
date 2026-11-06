package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.workspace.infrastructure.WorkspaceGraph;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Checks that a {@code :DataModelRef} id is active for a given field key. */
@Component
public class DataModelRefActiveLookup {

  private final WorkspaceGraph graph;

  public DataModelRefActiveLookup(WorkspaceGraph graph) {
    this.graph = graph;
  }

  public boolean existsActive(String fieldKey, String refId) {
    if (!StringUtils.hasText(fieldKey) || !StringUtils.hasText(refId)) {
      return false;
    }
    return graph
        .query(
            """
            MATCH (r:DataModelRef {workspaceId: $workspaceId, id: $id, fieldKey: $fieldKey})
            WHERE coalesce(r.active, true) = true
            RETURN count(r) AS c
            """)
        .bind(refId)
        .to("id")
        .bind(fieldKey)
        .to("fieldKey")
        .fetch()
        .first()
        .map(row -> ((Number) row.get("c")).longValue() > 0)
        .orElse(false);
  }
}
