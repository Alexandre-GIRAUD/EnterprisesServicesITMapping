package com.enterprise.itmapping.feature.businessunit.application;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.businessunit.infrastructure.persistence.BusinessUnitRepository;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Maintains {@code (:BusinessUnit)-[:HAS_APPLICATION]->(:Application)}. At most one BU link per
 * application node (incoming {@code HAS_APPLICATION}).
 */
@Service
public class BusinessUnitApplicationLinkService {

  private static final String DELETE_INCOMING =
      """
      MATCH (a:Application {id: $appId})
      OPTIONAL MATCH (bu:BusinessUnit)-[r:HAS_APPLICATION]->(a)
      DELETE r
      """;

  private static final String MERGE_LINK =
      """
      MATCH (bu:BusinessUnit {id: $buId})
      MATCH (a:Application {id: $appId})
      MERGE (bu)-[:HAS_APPLICATION]->(a)
      """;

  private final Neo4jClient neo4jClient;
  private final ApplicationRepository applicationRepository;
  private final BusinessUnitRepository businessUnitRepository;

  public BusinessUnitApplicationLinkService(
      Neo4jClient neo4jClient,
      ApplicationRepository applicationRepository,
      BusinessUnitRepository businessUnitRepository) {
    this.neo4jClient = neo4jClient;
    this.applicationRepository = applicationRepository;
    this.businessUnitRepository = businessUnitRepository;
  }

  /**
   * Clears existing incoming {@code HAS_APPLICATION} edges, then optionally links {@code buId}.
   *
   * @param businessUnitId {@code null} or blank to detach only
   * @return {@code false} when no application exists with {@code applicationId}
   */
  @Transactional
  public boolean setBusinessUnitForApplication(String applicationId, String businessUnitId) {
    if (applicationRepository.findProjectionById(applicationId).isEmpty()) {
      return false;
    }
    String bu =
        businessUnitId != null && !businessUnitId.isBlank() ? businessUnitId.trim() : null;
    if (bu != null && !businessUnitRepository.existsById(bu)) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Business unit introuvable: " + bu);
    }

    neo4jClient.query(DELETE_INCOMING).bind(applicationId).to("appId").run();

    if (bu != null) {
      neo4jClient
          .query(MERGE_LINK)
          .bind(bu).to("buId")
          .bind(applicationId).to("appId")
          .run();
    }
    return true;
  }
}
