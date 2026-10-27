package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.domain.Application;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ApplicationService {

  private final ApplicationRepository applicationRepository;
  private final Neo4jClient neo4jClient;
  private final ApplicationModuleSubtreeQuery moduleSubtreeQuery;
  private final ApplicationNodeAttributeReader nodeAttributeReader;
  private final ApplicationNodeRefLinkReader nodeRefLinkReader;

  public ApplicationService(
      ApplicationRepository applicationRepository,
      Neo4jClient neo4jClient,
      ApplicationModuleSubtreeQuery moduleSubtreeQuery,
      ApplicationNodeAttributeReader nodeAttributeReader,
      ApplicationNodeRefLinkReader nodeRefLinkReader) {
    this.applicationRepository = applicationRepository;
    this.neo4jClient = neo4jClient;
    this.moduleSubtreeQuery = moduleSubtreeQuery;
    this.nodeAttributeReader = nodeAttributeReader;
    this.nodeRefLinkReader = nodeRefLinkReader;
  }

  @Transactional(readOnly = true)
  public List<ApplicationResponse> findAll() {
    List<ApplicationGraphNodeProjection> rows = applicationRepository.findAllForGraph();
    var flags =
        moduleSubtreeQuery.hasAnyModuleViaContainsBatch(
            rows.stream().map(ApplicationGraphNodeProjection::getId).collect(Collectors.toList()));
    return rows.stream()
        .map(
            p ->
                new ApplicationResponse(
                    p.getId(),
                    p.getName(),
                    p.getDescription(),
                    flags.getOrDefault(p.getId(), false),
                    Map.of()))
        .collect(Collectors.toList());
  }

  @Transactional(readOnly = true)
  public Optional<ApplicationResponse> findById(String id) {
    return applicationRepository.findProjectionById(id).map(this::toDetailResponse);
  }

  @Transactional
  public ApplicationResponse create(ApplicationRequest request) {
    List<String> incoming =
        GithubRepoIdentityResolver.resolveAllFullNames(request.name(), request.description());
    if (!incoming.isEmpty()) {
      for (ApplicationGraphNodeProjection row : applicationRepository.findAllForGraph()) {
        String overlap =
            GithubRepoIdentityResolver.firstOverlap(
                incoming,
                GithubRepoIdentityResolver.resolveAllFullNames(row.getName(), row.getDescription()));
        if (overlap != null) {
          throw new ResponseStatusException(
              HttpStatus.CONFLICT, "Repository already linked: " + overlap);
        }
      }
    }
    Application entity = new Application();
    entity.setName(request.name());
    entity.setDescription(request.description());
    Application saved = applicationRepository.save(entity);
    return new ApplicationResponse(
        saved.getId(),
        saved.getName(),
        saved.getDescription(),
        moduleSubtreeQuery.hasAnyModuleViaContains(saved.getId()),
        nodeAttributeReader.read(saved.getId()));
  }

  /**
   * In-place update of the identity fields {@code name} and {@code description}. Data Model NODE
   * attributes are updated separately (see {@link ApplicationNodeAttributePatchService}).
   */
  @Transactional
  public Optional<ApplicationResponse> update(String id, ApplicationRequest request) {
    if (applicationRepository.findProjectionById(id).isEmpty()) {
      return Optional.empty();
    }
    List<String> incoming =
        GithubRepoIdentityResolver.resolveAllFullNames(request.name(), request.description());
    if (!incoming.isEmpty()) {
      for (ApplicationGraphNodeProjection row : applicationRepository.findAllForGraph()) {
        if (id.equals(row.getId())) {
          continue;
        }
        String overlap =
            GithubRepoIdentityResolver.firstOverlap(
                incoming,
                GithubRepoIdentityResolver.resolveAllFullNames(row.getName(), row.getDescription()));
        if (overlap != null) {
          throw new ResponseStatusException(
              HttpStatus.CONFLICT, "Repository already linked: " + overlap);
        }
      }
    }
    Map<String, Object> params = new HashMap<>();
    params.put("id", id);
    params.put("name", request.name());
    params.put("desc", request.description() != null ? request.description() : "");
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $id})
            SET a.name = $name, a.description = $desc
            """)
        .bindAll(params)
        .run();
    return applicationRepository.findProjectionById(id).map(this::toDetailResponse);
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

  private ApplicationResponse toDetailResponse(ApplicationGraphNodeProjection p) {
    Map<String, List<ApplicationResponse.NodeRefSummary>> refs = toNodeRefs(p.getId());
    return new ApplicationResponse(
        p.getId(),
        p.getName(),
        p.getDescription(),
        moduleSubtreeQuery.hasAnyModuleViaContains(p.getId()),
        nodeAttributeReader.read(p.getId()),
        refs);
  }

  private Map<String, List<ApplicationResponse.NodeRefSummary>> toNodeRefs(String applicationId) {
    Map<String, List<ApplicationNodeRefLinkReader.RefSummary>> raw =
        nodeRefLinkReader.read(applicationId);
    if (raw.isEmpty()) {
      return Map.of();
    }
    Map<String, List<ApplicationResponse.NodeRefSummary>> out = new HashMap<>();
    for (var entry : raw.entrySet()) {
      out.put(
          entry.getKey(),
          entry.getValue().stream()
              .map(
                  r ->
                      new ApplicationResponse.NodeRefSummary(
                          r.id(), r.name(), r.value()))
              .toList());
    }
    return Map.copyOf(out);
  }
}
