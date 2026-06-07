package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.presentation.dto.BusinessUnitSummary;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.Neo4jValueMapping;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Resolves {@link BusinessUnitSummary} for an application via
 * {@code (:BusinessUnit)-[:HAS_APPLICATION]->(:Application)}.
 */
@Component
public class ApplicationBusinessUnitLookup {

  private static final String CYPHER =
      """
      MATCH (a:Application {id: $appId})
      OPTIONAL MATCH (bu:BusinessUnit)-[:HAS_APPLICATION]->(a)
      RETURN bu.id AS id, bu.name AS name, bu.code AS code, bu.description AS description
      LIMIT 1
      """;

  private final Neo4jClient neo4jClient;

  public ApplicationBusinessUnitLookup(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public Optional<BusinessUnitSummary> findForApplication(String applicationId) {
    return neo4jClient
        .query(CYPHER)
        .bind(applicationId)
        .to("appId")
        .fetch()
        .first()
        .map(Neo4jValueMapping::asMap)
        .flatMap(ApplicationBusinessUnitLookup::mapRow);
  }

  private static Optional<BusinessUnitSummary> mapRow(Map<String, Object> map) {
    String id = Neo4jValueMapping.asString(map.get("id"));
    if (id == null || id.isBlank()) {
      return Optional.empty();
    }
    return Optional.of(
        new BusinessUnitSummary(
            id,
            Neo4jValueMapping.asString(map.get("name")),
            Neo4jValueMapping.asString(map.get("code")),
            Neo4jValueMapping.asString(map.get("description"))));
  }
}
