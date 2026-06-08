package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.presentation.dto.RegionSummary;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.Neo4jValueMapping;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Resolves {@link RegionSummary} for an application via {@code (Application)-[:IS_USED_IN]->(Region)}.
 */
@Component
public class ApplicationRegionLookup {

  private static final String CYPHER =
      """
      MATCH (a:Application {id: $appId})
      OPTIONAL MATCH (a)-[:IS_USED_IN]->(r:Region)
      RETURN r.id AS id, r.code AS code, r.name AS name
      ORDER BY toUpper(r.code)
      """;

  private final Neo4jClient neo4jClient;

  public ApplicationRegionLookup(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public List<RegionSummary> findForApplication(String applicationId) {
    List<RegionSummary> out = new ArrayList<>();
    neo4jClient
        .query(CYPHER)
        .bind(applicationId)
        .to("appId")
        .fetch()
        .all()
        .forEach(
            row -> {
              Map<String, Object> map = Neo4jValueMapping.asMap(row);
              String id = Neo4jValueMapping.asString(map.get("id"));
              if (id == null || id.isBlank()) {
                return;
              }
              out.add(
                  new RegionSummary(
                      id,
                      Neo4jValueMapping.asString(map.get("code")),
                      Neo4jValueMapping.asString(map.get("name"))));
            });
    out.sort(Comparator.comparing(r -> r.code() != null ? r.code() : "", String.CASE_INSENSITIVE_ORDER));
    return out;
  }
}
