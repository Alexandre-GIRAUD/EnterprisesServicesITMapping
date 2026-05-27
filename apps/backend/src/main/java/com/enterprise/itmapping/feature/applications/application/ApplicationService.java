package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.common.Neo4jTemporalParameters;
import com.enterprise.itmapping.domain.Application;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorSummaryDto;
import java.time.Instant;
import java.util.Collections;
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
  public List<ApplicationResponse> findAll(Instant validAt) {
    Instant pointInTime = validAt != null ? validAt : Instant.now();
    List<ApplicationGraphNodeProjection> rows =
        applicationRepository.findAllValidAtForGraph(pointInTime);
    var flags =
        moduleSubtreeQuery.hasAnyModuleViaContainsBatch(
            rows.stream().map(ApplicationGraphNodeProjection::getId).collect(Collectors.toList()));
    return rows.stream()
        .map(p -> graphProjectionToResponse(p, flags.getOrDefault(p.getId(), false)))
        .collect(Collectors.toList());
  }

  @Transactional(readOnly = true)
  public Optional<ApplicationResponse> findById(String id, Instant validAt) {
    Instant pointInTime = validAt != null ? validAt : Instant.now();
    return applicationRepository
        .findByIdValidAtForGraph(id, pointInTime)
        .map(p -> toResponseWithBusinessUnit(p, pointInTime));
  }

  @Transactional
  public ApplicationResponse create(ApplicationRequest request) {
    Application entity = new Application();
    entity.setName(request.name());
    entity.setDescription(request.description());
    entity.setValidFrom(request.validFrom());
    entity.setValidTo(request.validTo());
    Application saved = applicationRepository.save(entity);
    return toResponse(saved);
  }

  /** In-place update (overwrites). Prefer {@link #softUpdate} for temporal history. */
  @Transactional
  public Optional<ApplicationResponse> update(String id, ApplicationRequest request) {
    if (applicationRepository.findProjectionById(id).isEmpty()) {
      return Optional.empty();
    }
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $id})
            SET a.name = $name, a.description = $desc
            """)
        .bindAll(
            Map.of(
                "id", id,
                "name", request.name(),
                "desc", request.description() != null ? request.description() : ""))
        .run();
    if (request.validFrom() != null) {
      neo4jClient
          .query("MATCH (a:Application {id: $id}) SET a.validFrom = $vf")
          .bind(id).to("id")
          .bind(Neo4jTemporalParameters.toNeo4j(request.validFrom())).to("vf")
          .run();
    }
    if (request.validTo() != null) {
      neo4jClient
          .query("MATCH (a:Application {id: $id}) SET a.validTo = $vt")
          .bind(id).to("id")
          .bind(Neo4jTemporalParameters.toNeo4j(request.validTo())).to("vt")
          .run();
    }
    return applicationRepository.findByIdValidAtForGraph(id, Instant.now()).map(p -> toResponseWithBusinessUnit(p, Instant.now()));
  }

  /**
   * Soft-update: closes the current version (sets validTo = now) and creates a new version
   * with validFrom = now and the updated data. Returns the new version.
   */
  @Transactional
  public Optional<ApplicationResponse> softUpdate(String id, ApplicationRequest request) {
    if (applicationRepository.findCurrentProjectionById(id).isEmpty()) {
      return Optional.empty();
    }

    Instant now = Instant.now();
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $id})
            WHERE a.validTo IS NULL
            SET a.validTo = $now
            """)
        .bind(id).to("id")
        .bind(Neo4jTemporalParameters.toNeo4j(now)).to("now")
        .run();

    Application newVersion = new Application();
    newVersion.setName(request.name());
    newVersion.setDescription(request.description());
    newVersion.setValidFrom(now);
    newVersion.setValidTo(null);
    Application saved = applicationRepository.save(newVersion);
    return Optional.of(toResponse(saved));
  }

  /**
   * Deletes the Application vertex identified by {@code id} ({@link Application#getId()}), together
   * with:
   * <ul>
   *   <li>all descendant {@code Module} nodes reachable via outbound {@code CONTAINS*} (bounded 1–50 hops);
   *   <li>all relationships touching that application ({@code DEPENDS_ON}, {@code CONTAINS}, {@code VALID_DURING}, etc.) via {@code DETACH DELETE}.
   * </ul>
   * <p>If your data model uses temporal <em>duplicate</em> Application nodes over time ({@link
   * #softUpdate}), {@code id} refers to <strong>a single node's id</strong> — deleting does not remove
   * other versions that may share the same name.
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
    Instant validAt = a.getValidFrom() != null ? a.getValidFrom() : Instant.now();
    List<ContributorSummaryDto> contributors =
        applicationContributorLookup.findForApplication(a.getId());
    return new ApplicationResponse(
        a.getId(),
        a.getName(),
        a.getDescription(),
        a.getValidFrom(),
        a.getValidTo(),
        moduleSubtreeQuery.hasAnyModuleViaContains(a.getId()),
        applicationBusinessUnitLookup.findForApplication(a.getId(), validAt).orElse(null),
        contributors,
        applicationRegionLookup.findForApplication(a.getId(), validAt));
  }

  private ApplicationResponse toResponseWithBusinessUnit(
      ApplicationGraphNodeProjection p, Instant validAt) {
    List<ContributorSummaryDto> contributors =
        applicationContributorLookup.findForApplication(p.getId());
    return new ApplicationResponse(
        p.getId(),
        p.getName(),
        p.getDescription(),
        p.getValidFrom(),
        p.getValidTo(),
        moduleSubtreeQuery.hasAnyModuleViaContains(p.getId()),
        applicationBusinessUnitLookup.findForApplication(p.getId(), validAt).orElse(null),
        contributors,
        applicationRegionLookup.findForApplication(p.getId(), validAt));
  }

  private ApplicationResponse graphProjectionToResponse(
      ApplicationGraphNodeProjection p, boolean hasModuleSubtree) {
    return new ApplicationResponse(
        p.getId(),
        p.getName(),
        p.getDescription(),
        p.getValidFrom(),
        p.getValidTo(),
        hasModuleSubtree,
        null,
        Collections.emptyList(),
        Collections.emptyList());
  }
}
