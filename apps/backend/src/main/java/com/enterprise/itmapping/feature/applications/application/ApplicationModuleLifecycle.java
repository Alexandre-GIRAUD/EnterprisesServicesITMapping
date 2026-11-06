package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.attributeaudit.application.EntityLifecycleHistory;
import com.enterprise.itmapping.feature.workspace.infrastructure.WorkspaceGraph;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Module creation and removal with their history events. */
@Component
public class ApplicationModuleLifecycle {

  private final WorkspaceGraph graph;
  private final EntityLifecycleHistory history;

  public ApplicationModuleLifecycle(WorkspaceGraph graph, EntityLifecycleHistory history) {
    this.graph = graph;
    this.history = history;
  }

  public void recordCreated(String applicationId, String moduleId, String name) {
    history.moduleCreated(applicationId, moduleId, name);
  }

  /** Deletes every module under the application, each one leaving a deletion event. */
  public void removeAll(String applicationId) {
    graph
        .query(
            """
            MATCH (:Application {workspaceId: $workspaceId, id: $id})-[:CONTAINS*1..50]->(m:Module {workspaceId: $workspaceId})
            RETURN DISTINCT m.id AS id, m.name AS name
            """)
        .bind(applicationId)
        .to("id")
        .fetch()
        .all()
        .forEach(module -> recordDeleted(applicationId, module));
    graph
        .query(
            """
            MATCH (:Application {workspaceId: $workspaceId, id: $id})-[:CONTAINS*1..50]->(m:Module {workspaceId: $workspaceId})
            WITH DISTINCT m
            DETACH DELETE m
            """)
        .bind(applicationId)
        .to("id")
        .run();
  }

  private void recordDeleted(String applicationId, Map<String, Object> module) {
    Object name = module.get("name");
    history.moduleDeleted(
        applicationId, String.valueOf(module.get("id")), name == null ? null : String.valueOf(name));
  }
}
