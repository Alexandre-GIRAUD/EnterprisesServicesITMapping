package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.attributeaudit.application.EntityLifecycleHistory;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/** Module creation and removal with their history events. */
@Component
public class ApplicationModuleLifecycle {

  private final Neo4jClient neo4jClient;
  private final EntityLifecycleHistory history;

  public ApplicationModuleLifecycle(Neo4jClient neo4jClient, EntityLifecycleHistory history) {
    this.neo4jClient = neo4jClient;
    this.history = history;
  }

  public void recordCreated(String applicationId, String moduleId, String name) {
    history.moduleCreated(applicationId, moduleId, name);
  }

  /** Deletes every module under the application, each one leaving a deletion event. */
  public void removeAll(String applicationId) {
    neo4jClient
        .query(
            """
            MATCH (:Application {id: $id})-[:CONTAINS*1..50]->(m:Module)
            RETURN DISTINCT m.id AS id, m.name AS name
            """)
        .bind(applicationId)
        .to("id")
        .fetch()
        .all()
        .forEach(module -> recordDeleted(applicationId, module));
    neo4jClient
        .query(
            """
            MATCH (:Application {id: $id})-[:CONTAINS*1..50]->(m:Module)
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
