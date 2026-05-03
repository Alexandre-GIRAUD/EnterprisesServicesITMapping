package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.graph.infrastructure.persistence.Neo4jValueMapping;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Detects whether an {@code Application} already has a {@code Module} subtree via outbound {@code
 * CONTAINS} (1–50 hops, aligned with delete / module-graph bounds).
 */
@Component
public class ApplicationModuleSubtreeQuery {

  private static final int MAX_CONTAINS_HOPS = 50;

  private final Neo4jClient neo4jClient;

  public ApplicationModuleSubtreeQuery(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  /** True when at least one {@code Module} is reachable from the application through {@code CONTAINS}. */
  public boolean hasAnyModuleViaContains(String applicationId) {
    if (applicationId == null || applicationId.isBlank()) {
      return false;
    }
    String cypher =
        """
        MATCH (a:Application {id: $id})
        RETURN EXISTS((a)-[:CONTAINS*1..%d]->(:Module)) AS hasMods
        """
            .formatted(MAX_CONTAINS_HOPS);
    return neo4jClient
        .query(cypher)
        .bind(applicationId)
        .to("id")
        .fetch()
        .first()
        .map(
            row -> {
              Object v = Neo4jValueMapping.asMap(row).get("hasMods");
              if (v instanceof Boolean b) {
                return b;
              }
              return Boolean.parseBoolean(String.valueOf(v));
            })
        .orElse(false);
  }

  /**
   * Batch lookup for {@link com.enterprise.itmapping.feature.applications.application.ApplicationService}
   * list endpoint. Missing application ids are omitted (treated as false when mapping responses).
   */
  public Map<String, Boolean> hasAnyModuleViaContainsBatch(Collection<String> applicationIds) {
    if (applicationIds == null || applicationIds.isEmpty()) {
      return Map.of();
    }
    List<String> ids = applicationIds.stream().filter(id -> id != null && !id.isBlank()).distinct().toList();
    if (ids.isEmpty()) {
      return Map.of();
    }

    String cypher =
        """
        UNWIND $ids AS appId
        MATCH (a:Application {id: appId})
        RETURN a.id AS id, EXISTS((a)-[:CONTAINS*1..%d]->(:Module)) AS hasMods
        """
            .formatted(MAX_CONTAINS_HOPS);

    Map<String, Boolean> out = new HashMap<>();
    neo4jClient.query(cypher).bind(ids).to("ids").fetch().all().forEach(row -> {
      Map<String, Object> map = Neo4jValueMapping.asMap(row);
      String id = Neo4jValueMapping.asString(map.get("id"));
      Object v = map.get("hasMods");
      boolean flag = v instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(v));
      if (id != null && !id.isBlank()) {
        out.put(id, flag);
      }
    });
    return Collections.unmodifiableMap(out);
  }
}
