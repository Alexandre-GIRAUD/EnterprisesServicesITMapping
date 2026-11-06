package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.workspace.infrastructure.WorkspaceGraph;
import java.util.List;
import org.springframework.stereotype.Component;

/** Application that contains a module, so its audit events show up in that application history. */
@Component
public class ModuleOwnerLookup {

  private final WorkspaceGraph graph;

  public ModuleOwnerLookup(WorkspaceGraph graph) {
    this.graph = graph;
  }

  public List<String> applicationIds(String moduleId) {
    return graph
        .query(
            """
            MATCH (a:Application {workspaceId: $workspaceId})-[:CONTAINS*1..50]->(:Module {workspaceId: $workspaceId, id: $id})
            RETURN DISTINCT a.id AS id
            """)
        .bind(moduleId)
        .to("id")
        .fetch()
        .all()
        .stream()
        .map(row -> String.valueOf(row.get("id")))
        .toList();
  }
}
