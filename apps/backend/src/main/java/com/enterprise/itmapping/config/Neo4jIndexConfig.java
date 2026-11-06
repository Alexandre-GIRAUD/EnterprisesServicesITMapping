package com.enterprise.itmapping.config;

import com.enterprise.itmapping.feature.workspace.domain.Workspaces;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Creates indexes for graph queries. Run once at startup (idempotent with IF NOT EXISTS).
 *
 * <p>Only identity lookups are indexed: business attributes are Data Model driven, so their
 * property names are not known at build time.
 */
@Component
public class Neo4jIndexConfig implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(Neo4jIndexConfig.class);

  private static final String[] INDEX_STATEMENTS = {
      "CREATE RANGE INDEX application_id IF NOT EXISTS FOR (n:Application) ON (n.id)",
      "CREATE RANGE INDEX module_id IF NOT EXISTS FOR (n:Module) ON (n.id)",
      "CREATE RANGE INDEX data_model_ref_id IF NOT EXISTS FOR (n:DataModelRef) ON (n.id)",
      "CREATE RANGE INDEX data_model_ref_field_key IF NOT EXISTS FOR (n:DataModelRef) ON (n.fieldKey)",
      "CREATE RANGE INDEX application_workspace IF NOT EXISTS FOR (n:Application) ON (n.workspaceId, n.id)",
      "CREATE RANGE INDEX module_workspace IF NOT EXISTS FOR (n:Module) ON (n.workspaceId, n.id)",
      "CREATE RANGE INDEX data_model_ref_workspace IF NOT EXISTS FOR (n:DataModelRef) ON (n.workspaceId, n.id)",
  };

  /** Nodes written before workspaces existed belong to the Default workspace. */
  private static final String ADOPT_ORPHAN_NODES =
      """
      MATCH (n)
      WHERE (n:Application OR n:Module OR n:DataModelRef) AND n.workspaceId IS NULL
      SET n.workspaceId = $workspaceId
      """;

  private final Neo4jClient neo4jClient;

  public Neo4jIndexConfig(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  @Override
  public void run(ApplicationArguments args) {
    for (String cypher : INDEX_STATEMENTS) {
      try {
        neo4jClient.query(cypher).run();
      } catch (Exception e) {
        log.warn("Index creation (may already exist): {}", e.getMessage());
      }
    }
    neo4jClient
        .query(ADOPT_ORPHAN_NODES)
        .bind(Workspaces.DEFAULT_ID.toString())
        .to("workspaceId")
        .run();
  }
}
