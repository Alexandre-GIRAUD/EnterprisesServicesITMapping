package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorSummaryDto;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.Neo4jValueMapping;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Contributors linked to an application via {@code (:Contributor)-[:WORK_ON]->(:Application)}.
 * Matches the application node id from the API.
 */
@Component
public class ApplicationContributorLookup {

  private static final String CYPHER =
      """
      MATCH (c:Contributor)-[:WORK_ON]->(a:Application {id: $appId})
      RETURN DISTINCT c.id AS id, c.firstName AS firstName, c.lastName AS lastName
      ORDER BY c.lastName, c.firstName
      """;

  private final Neo4jClient neo4jClient;

  public ApplicationContributorLookup(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public List<ContributorSummaryDto> findForApplication(String applicationId) {
    List<ContributorSummaryDto> out = new ArrayList<>();
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
                  new ContributorSummaryDto(
                      id,
                      Neo4jValueMapping.asString(map.get("firstName")),
                      Neo4jValueMapping.asString(map.get("lastName"))));
            });
    return out;
  }
}
