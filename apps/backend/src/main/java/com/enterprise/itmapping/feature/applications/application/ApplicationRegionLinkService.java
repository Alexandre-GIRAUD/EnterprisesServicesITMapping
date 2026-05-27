package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.region.infrastructure.persistence.RegionRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Maintains {@code (:Application)-[:IS_USED_IN]->(:Region)} links. Replaces the full set per patch
 * request.
 */
@Service
public class ApplicationRegionLinkService {

  private static final String DELETE_OUTGOING_TO_REGION =
      """
      MATCH (a:Application {id: $appId})
      OPTIONAL MATCH (a)-[r:IS_USED_IN]->(:Region)
      DELETE r
      """;

  private static final String CREATE_LINKS =
      """
      MATCH (a:Application {id: $appId})
      MATCH (reg:Region)
      WHERE toUpper(reg.code) IN $codes
      CREATE (a)-[:IS_USED_IN]->(reg)
      """;

  private final Neo4jClient neo4jClient;
  private final ApplicationRepository applicationRepository;
  private final RegionRepository regionRepository;

  public ApplicationRegionLinkService(
      Neo4jClient neo4jClient,
      ApplicationRepository applicationRepository,
      RegionRepository regionRepository) {
    this.neo4jClient = neo4jClient;
    this.applicationRepository = applicationRepository;
    this.regionRepository = regionRepository;
  }

  /**
   * Replaces all outgoing {@code IS_USED_IN} edges to {@code Region}. {@code regionCodes} may be
   * null or empty → no links.
   *
   * @throws ResponseStatusException {@code 400} if any code is unknown
   * @return {@code false} when no application exists with {@code applicationId}
   */
  @Transactional
  public boolean setRegionsForApplication(String applicationId, List<String> regionCodes) {
    if (applicationRepository.findProjectionById(applicationId).isEmpty()) {
      return false;
    }
    Set<String> normalized = new LinkedHashSet<>();
    if (regionCodes != null) {
      for (String raw : regionCodes) {
        if (raw == null) {
          continue;
        }
        String n = raw.trim().toUpperCase(Locale.ROOT);
        if (!n.isEmpty()) {
          normalized.add(n);
        }
      }
    }
    for (String code : normalized) {
      if (!regionRepository.existsByCodeIgnoreCase(code)) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Region inconnue ou code invalide: " + code);
      }
    }

    neo4jClient.query(DELETE_OUTGOING_TO_REGION).bind(applicationId).to("appId").run();

    if (!normalized.isEmpty()) {
      List<String> codesList = normalized.stream().sorted().collect(Collectors.toList());
      neo4jClient
          .query(CREATE_LINKS)
          .bind(applicationId)
          .to("appId")
          .bind(codesList)
          .to("codes")
          .run();
    }
    return true;
  }
}
