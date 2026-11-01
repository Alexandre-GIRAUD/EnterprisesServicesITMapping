package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import java.util.List;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/** Application that contains a module, so its audit events show up in that application history. */
@Component
public class ModuleOwnerLookup {

  private final Neo4jClient neo4jClient;

  public ModuleOwnerLookup(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public List<String> applicationIds(String moduleId) {
    return neo4jClient
        .query(
            """
            MATCH (a:Application)-[:CONTAINS*1..50]->(:Module {id: $id})
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
