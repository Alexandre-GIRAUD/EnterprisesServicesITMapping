package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.domain.Application;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorSummaryDto;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApplicationService {

  private final ApplicationRepository applicationRepository;
  private final Neo4jClient neo4jClient;
  private final ApplicationModuleSubtreeQuery moduleSubtreeQuery;
  private final ApplicationBusinessUnitLookup applicationBusinessUnitLookup;
  private final ApplicationContributorLookup applicationContributorLookup;
  private final ApplicationRegionLookup applicationRegionLookup;

  public ApplicationService(
      ApplicationRepository applicationRepository,
      Neo4jClient neo4jClient,
      ApplicationModuleSubtreeQuery moduleSubtreeQuery,
      ApplicationBusinessUnitLookup applicationBusinessUnitLookup,
      ApplicationContributorLookup applicationContributorLookup,
      ApplicationRegionLookup applicationRegionLookup) {
    this.applicationRepository = applicationRepository;
    this.neo4jClient = neo4jClient;
    this.moduleSubtreeQuery = moduleSubtreeQuery;
    this.applicationBusinessUnitLookup = applicationBusinessUnitLookup;
    this.applicationContributorLookup = applicationContributorLookup;
    this.applicationRegionLookup = applicationRegionLookup;
  }

  @Transactional(readOnly = true)
  public List<ApplicationResponse> findAll() {
    List<ApplicationGraphNodeProjection> rows = applicationRepository.findAllForGraph();
    var flags =
        moduleSubtreeQuery.hasAnyModuleViaContainsBatch(
            rows.stream().map(ApplicationGraphNodeProjection::getId).collect(Collectors.toList()));
    return rows.stream()
        .map(p -> graphProjectionToResponse(p, flags.getOrDefault(p.getId(), false)))
        .collect(Collectors.toList());
  }

  @Transactional(readOnly = true)
  public Optional<ApplicationResponse> findById(String id) {
    return applicationRepository.findByIdForGraph(id).map(this::toResponseWithBusinessUnit);
  }

  @Transactional
  public ApplicationResponse create(ApplicationRequest request) {
    Application entity = new Application();
    entity.setName(request.name());
    entity.setDescription(request.description());
    entity.setYear(request.year());
    Application saved = applicationRepository.save(entity);
    return toResponse(saved);
  }

  /** In-place update of {@code name}, {@code description}, {@code year}. */
  @Transactional
  public Optional<ApplicationResponse> update(String id, ApplicationRequest request) {
    if (applicationRepository.findProjectionById(id).isEmpty()) {
      return Optional.empty();
    }
    Map<String, Object> params = new HashMap<>();
    params.put("id", id);
    params.put("name", request.name());
    params.put("desc", request.description() != null ? request.description() : "");
    params.put("year", request.year());
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $id})
            SET a.name = $name, a.description = $desc, a.year = $year
            """)
        .bindAll(params)
        .run();
    return applicationRepository.findByIdForGraph(id).map(this::toResponseWithBusinessUnit);
  }

  /**
   * Deletes the Application vertex identified by {@code id} ({@link Application#getId()}), together
   * with:
   * <ul>
   *   <li>all descendant {@code Module} nodes reachable via outbound {@code CONTAINS*} (bounded 1–50 hops);
   *   <li>all relationships touching that application ({@code DEPENDS_ON}, {@code CONTAINS}, etc.) via {@code DETACH DELETE}.
   * </ul>
   *
   * @return {@code false} when no Application exists with {@code id}
   */
  @Transactional
  public boolean delete(String id) {
    if (applicationRepository.findProjectionById(id).isEmpty()) {
      return false;
    }

    neo4jClient
        .query(
            """
            MATCH (:Application {id: $id})-[:CONTAINS*1..50]->(m:Module)
            WITH DISTINCT m
            DETACH DELETE m
            """)
        .bind(id)
        .to("id")
        .run();

    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $id})
            DETACH DELETE a
            """)
        .bind(id)
        .to("id")
        .run();

    return true;
  }

  private ApplicationResponse toResponse(Application a) {
    List<ContributorSummaryDto> contributors =
        applicationContributorLookup.findForApplication(a.getId());
    return new ApplicationResponse(
        a.getId(),
        a.getName(),
        a.getDescription(),
        a.getYear(),
        moduleSubtreeQuery.hasAnyModuleViaContains(a.getId()),
        applicationBusinessUnitLookup.findForApplication(a.getId()).orElse(null),
        contributors,
        applicationRegionLookup.findForApplication(a.getId()));
  }

  private ApplicationResponse toResponseWithBusinessUnit(ApplicationGraphNodeProjection p) {
    List<ContributorSummaryDto> contributors =
        applicationContributorLookup.findForApplication(p.getId());
    return new ApplicationResponse(
        p.getId(),
        p.getName(),
        p.getDescription(),
        p.getYear(),
        moduleSubtreeQuery.hasAnyModuleViaContains(p.getId()),
        applicationBusinessUnitLookup.findForApplication(p.getId()).orElse(null),
        contributors,
        applicationRegionLookup.findForApplication(p.getId()));
  }

  private ApplicationResponse graphProjectionToResponse(
      ApplicationGraphNodeProjection p, boolean hasModuleSubtree) {
    return new ApplicationResponse(
        p.getId(),
        p.getName(),
        p.getDescription(),
        p.getYear(),
        hasModuleSubtree,
        null,
        Collections.emptyList(),
        Collections.emptyList());
  }
}
