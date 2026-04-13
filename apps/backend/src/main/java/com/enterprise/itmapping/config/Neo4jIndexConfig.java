package com.enterprise.itmapping.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Creates indexes for temporal queries. Run once at startup (idempotent with IF NOT EXISTS).
 * Optimizes getGraphAtDate and other validAt filters for large graphs.
 */
@Component
public class Neo4jIndexConfig implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(Neo4jIndexConfig.class);

  private static final String[] INDEX_STATEMENTS = {
      "CREATE RANGE INDEX application_valid_from IF NOT EXISTS FOR (n:Application) ON (n.validFrom)",
      "CREATE RANGE INDEX application_valid_to IF NOT EXISTS FOR (n:Application) ON (n.validTo)",
      "CREATE RANGE INDEX application_id IF NOT EXISTS FOR (n:Application) ON (n.id)",
      "CREATE RANGE INDEX version_snapshot_valid_from IF NOT EXISTS FOR (n:VersionSnapshot) ON (n.validFrom)",
      "CREATE RANGE INDEX version_snapshot_valid_to IF NOT EXISTS FOR (n:VersionSnapshot) ON (n.validTo)",
  };

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
  }
}
