package com.enterprise.itmapping.feature.contributors.application;

import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorWriteRequest;
import java.util.LinkedHashSet;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Replaces outgoing {@code WORK_IN}, {@code WORK_ON}, and {@code REPORTS_TO} edges for a contributor.
 * Call after the {@link com.enterprise.itmapping.domain.Contributor} node exists.
 */
@Service
public class ContributorLinkService {

  private static final String CLEAR_WORK_IN =
      """
      MATCH (c:Contributor {id: $id})
      OPTIONAL MATCH (c)-[r:WORK_IN]->()
      DELETE r
      """;

  private static final String CLEAR_WORK_ON =
      """
      MATCH (c:Contributor {id: $id})
      OPTIONAL MATCH (c)-[r:WORK_ON]->()
      DELETE r
      """;

  private static final String CLEAR_REPORTS_TO =
      """
      MATCH (c:Contributor {id: $id})
      OPTIONAL MATCH (c)-[r:REPORTS_TO]->()
      DELETE r
      """;

  private static final String MERGE_WORK_IN =
      """
      MATCH (c:Contributor {id: $cid})
      MATCH (bu:BusinessUnit {id: $bid})
      MERGE (c)-[:WORK_IN]->(bu)
      """;

  private static final String MERGE_WORK_ON =
      """
      MATCH (c:Contributor {id: $cid})
      MATCH (a:Application {id: $aid})
      MERGE (c)-[:WORK_ON]->(a)
      """;

  private static final String MERGE_REPORTS_TO =
      """
      MATCH (c:Contributor {id: $cid})
      MATCH (m:Contributor {id: $mid})
      MERGE (c)-[:REPORTS_TO]->(m)
      """;

  private final Neo4jClient neo4jClient;

  public ContributorLinkService(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  @Transactional
  public void replaceAllLinks(String contributorId, ContributorWriteRequest request) {
    neo4jClient.query(CLEAR_WORK_IN).bind(contributorId).to("id").run();
    neo4jClient.query(CLEAR_WORK_ON).bind(contributorId).to("id").run();
    neo4jClient.query(CLEAR_REPORTS_TO).bind(contributorId).to("id").run();

    String bu = blankToNull(request.businessUnitId());
    if (bu != null) {
      neo4jClient
          .query(MERGE_WORK_IN)
          .bind(contributorId).to("cid")
          .bind(bu).to("bid")
          .run();
    }

    LinkedHashSet<String> distinctAppIds = new LinkedHashSet<>();
    for (String raw : request.applicationIds()) {
      if (raw != null && !raw.isBlank()) {
        distinctAppIds.add(raw.trim());
      }
    }
    for (String appId : distinctAppIds) {
      neo4jClient
          .query(MERGE_WORK_ON)
          .bind(contributorId).to("cid")
          .bind(appId).to("aid")
          .run();
    }

    String mgr = blankToNull(request.managerContributorId());
    if (mgr != null) {
      neo4jClient
          .query(MERGE_REPORTS_TO)
          .bind(contributorId).to("cid")
          .bind(mgr).to("mid")
          .run();
    }
  }

  private static String blankToNull(String s) {
    if (s == null) {
      return null;
    }
    String t = s.trim();
    return t.isEmpty() ? null : t;
  }
}
