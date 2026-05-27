package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.common.Neo4jTemporalParameters;
import com.enterprise.itmapping.feature.applications.presentation.dto.RegionSummary;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.Neo4jValueMapping;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Resolves {@link RegionSummary} for an application valid at {@code validAt} via {@code
 * (Application)-[:IS_USED_IN]->(Region)}.
 */
@Component
public class ApplicationRegionLookup {

  private static final String CYPHER =
      """
      MATCH (a:Application {id: $appId})
      WHERE (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
      OPTIONAL MATCH (a)-[:IS_USED_IN]->(r:Region)
      RETURN r.id AS id, r.code AS code, r.name AS name
      ORDER BY toUpper(r.code)
      """;

  private final Neo4jClient neo4jClient;

  public ApplicationRegionLookup(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public List<RegionSummary> findForApplication(String applicationId, Instant validAt) {
    Instant pointInTime = validAt != null ? validAt : Instant.now();
    List<RegionSummary> out = new ArrayList<>();
    neo4jClient
        .query(CYPHER)
        .bind(applicationId)
        .to("appId")
        .bind(Neo4jTemporalParameters.toNeo4j(pointInTime))
        .to("validAt")
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
