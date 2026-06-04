package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.common.Neo4jTemporalParameters;
import com.enterprise.itmapping.domain.VersionSnapshot;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.businessunit.infrastructure.persistence.BusinessUnitRepository;
import com.enterprise.itmapping.feature.region.infrastructure.persistence.RegionRepository;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeResponseDto;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.GraphLoader;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.VersionSnapshotRepository;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.VersionSnapshotDto;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GraphService {

  private static final Set<String> ALLOWED_EDGE_TYPES = Set.of("DEPENDS_ON", "CONTAINS");

  private final GraphLoader graphLoader;
  private final VersionSnapshotRepository versionSnapshotRepository;
  private final Neo4jClient neo4jClient;
  private final BusinessUnitRepository businessUnitRepository;
  private final RegionRepository regionRepository;
  private final ApplicationRepository applicationRepository;

  public GraphService(
      GraphLoader graphLoader,
      VersionSnapshotRepository versionSnapshotRepository,
      Neo4jClient neo4jClient,
      BusinessUnitRepository businessUnitRepository,
      RegionRepository regionRepository,
      ApplicationRepository applicationRepository
  ) {
    this.graphLoader = graphLoader;
    this.versionSnapshotRepository = versionSnapshotRepository;
    this.neo4jClient = neo4jClient;
    this.businessUnitRepository = businessUnitRepository;
    this.regionRepository = regionRepository;
    this.applicationRepository = applicationRepository;
  }

  /**
   * Creates a VersionSnapshot node and links it to all nodes currently valid (validTo IS NULL).
   */
  @Transactional
  public VersionSnapshotDto createNewSnapshot(String versionName) {
    Instant now = Instant.now();
    VersionSnapshot snapshot = new VersionSnapshot();
    snapshot.setVersionTag(versionName);
    snapshot.setValidFrom(now);
    snapshot.setValidTo(null);
    VersionSnapshot saved = versionSnapshotRepository.save(snapshot);
    int linked = graphLoader.linkCurrentNodesToSnapshot(saved.getId(), now);
    return new VersionSnapshotDto(
        saved.getId(),
        saved.getVersionTag(),
        saved.getDescription(),
        saved.getValidFrom(),
        saved.getValidTo(),
        linked
    );
  }

  /**
   * Returns only nodes and relationships valid at the given date.
   * Uses index-optimized temporal predicates for large graphs.
   */
  @Transactional(readOnly = true)
  public GraphResponseDto getGraphAtDate(
      Date date,
      List<String> applicationIds,
      List<String> businessUnitIds,
      List<String> regionCodes) {
    Instant pointInTime = date != null ? date.toInstant() : Instant.now();
    return getGraph(pointInTime, applicationIds, businessUnitIds, regionCodes);
  }

  /**
   * @param applicationIds optional; when non-empty, only listed application ids (OR).
   * @param businessUnitIds optional; when non-empty, applications under any listed BU (OR).
   * @param regionCodes optional; when non-empty, applications used in any listed region (OR,
   *     case-insensitive). Active dimensions combine with AND.
   */
  @Transactional(readOnly = true)
  public GraphResponseDto getGraph(
      Instant validAt,
      List<String> applicationIds,
      List<String> businessUnitIds,
      List<String> regionCodes) {
    Instant pointInTime = validAt != null ? validAt : Instant.now();
    List<String> appIds = resolveExistingApplicationIds(applicationIds);
    List<String> buIds = resolveExistingBusinessUnitIds(businessUnitIds);
    List<String> regions = resolveExistingRegionCodes(regionCodes);
    if (appIds != null && appIds.isEmpty()) {
      return new GraphResponseDto(List.of(), List.of());
    }
    if (buIds != null && buIds.isEmpty()) {
      return new GraphResponseDto(List.of(), List.of());
    }
    if (regions != null && regions.isEmpty()) {
      return new GraphResponseDto(List.of(), List.of());
    }

    List<GraphEdgeProjection> edges =
        graphLoader.loadEdges(pointInTime, appIds, buIds, regions);

    List<GraphNodeDto> nodes =
        graphLoader.loadNodesValidAt(pointInTime, appIds, buIds, regions).stream()
            .map(
                a ->
                    new GraphNodeDto(
                        a.id(),
                        a.name() != null ? a.name() : a.id(),
                        "Application",
                        toTemporalDto(a.validFrom(), a.validTo()),
                        null))
            .collect(Collectors.toList());

    List<GraphEdgeDto> edgeDtos = new ArrayList<>();
    int i = 0;
    for (GraphEdgeProjection e : edges) {
      edgeDtos.add(new GraphEdgeDto(
          "e" + i++,
          e.sourceId(),
          e.targetId(),
          e.type()
      ));
    }

    return new GraphResponseDto(nodes, edgeDtos);
  }

  /** {@code null} = no filter; empty list after validation = empty graph. */
  private List<String> resolveExistingApplicationIds(List<String> raw) {
    List<String> ids = normalizeIds(raw);
    if (ids == null) {
      return null;
    }
    List<String> existing =
        ids.stream().filter(applicationRepository::existsById).distinct().toList();
    return existing.isEmpty() ? List.of() : existing;
  }

  /** {@code null} = no filter; empty list after validation = empty graph. */
  private List<String> resolveExistingBusinessUnitIds(List<String> raw) {
    List<String> ids = normalizeIds(raw);
    if (ids == null) {
      return null;
    }
    List<String> existing =
        ids.stream().filter(businessUnitRepository::existsById).distinct().toList();
    return existing.isEmpty() ? List.of() : existing;
  }

  /** {@code null} = no filter; codes uppercased for Cypher {@code IN}. */
  private List<String> resolveExistingRegionCodes(List<String> raw) {
    List<String> codes = normalizeIds(raw);
    if (codes == null) {
      return null;
    }
    List<String> existing =
        codes.stream()
            .filter(regionRepository::existsByCodeIgnoreCase)
            .map(c -> c.toUpperCase())
            .distinct()
            .toList();
    return existing.isEmpty() ? List.of() : existing;
  }

  private static List<String> normalizeIds(List<String> raw) {
    if (raw == null || raw.isEmpty()) {
      return null;
    }
    List<String> ids =
        raw.stream()
            .filter(s -> s != null && !s.isBlank())
            .map(String::trim)
            .distinct()
            .toList();
    return ids.isEmpty() ? null : ids;
  }

  @Transactional
  public CreateGraphEdgeResponseDto createEdge(CreateGraphEdgeRequestDto request) {
    String sourceId = request.sourceId() != null ? request.sourceId().trim() : "";
    String targetId = request.targetId() != null ? request.targetId().trim() : "";
    String type = request.type() != null ? request.type().trim().toUpperCase() : "";

    if (sourceId.isEmpty() || targetId.isEmpty() || type.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "sourceId, targetId et type sont obligatoires.");
    }
    if (sourceId.equals(targetId)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "sourceId et targetId doivent etre differents.");
    }
    if (!ALLOWED_EDGE_TYPES.contains(type)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Type de relation non autorise: " + type);
    }

    Instant validFrom = request.validFrom() != null ? request.validFrom() : Instant.now();
    Instant validTo = request.validTo();

    boolean sourceExists =
        neo4jClient
            .query("MATCH (a:Application {id: $id}) RETURN count(a) AS cnt")
            .bind(sourceId)
            .to("id")
            .fetch()
            .first()
            .map(this::countIsPositive)
            .orElse(false);
    if (!sourceExists) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Source application introuvable: " + sourceId);
    }

    boolean targetExists =
        neo4jClient
            .query("MATCH (a:Application {id: $id}) RETURN count(a) AS cnt")
            .bind(targetId)
            .to("id")
            .fetch()
            .first()
            .map(this::countIsPositive)
            .orElse(false);
    if (!targetExists) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Target application introuvable: " + targetId);
    }

    String duplicateCypher =
        """
        MATCH (s:Application {id: $sourceId})-[r:%s]->(t:Application {id: $targetId})
        WHERE r.validTo IS NULL
        RETURN count(r) AS cnt
        """
            .formatted(type);

    boolean duplicateExists =
        neo4jClient
            .query(duplicateCypher)
            .bind(sourceId)
            .to("sourceId")
            .bind(targetId)
            .to("targetId")
            .fetch()
            .first()
            .map(this::countIsPositive)
            .orElse(false);
    if (duplicateExists) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Une relation active identique existe deja.");
    }

    String edgeId = UUID.randomUUID().toString();
    String createCypher =
        """
        MATCH (s:Application {id: $sourceId})
        MATCH (t:Application {id: $targetId})
        CREATE (s)-[r:%s]->(t)
        SET r.id = $edgeId, r.validFrom = $validFrom, r.validTo = $validTo
        RETURN r.id AS id, s.id AS sourceId, t.id AS targetId, type(r) AS type
        """
            .formatted(type);

    return neo4jClient
        .query(createCypher)
        .bind(sourceId)
        .to("sourceId")
        .bind(targetId)
        .to("targetId")
        .bind(edgeId)
        .to("edgeId")
        .bind(Neo4jTemporalParameters.toNeo4j(validFrom))
        .to("validFrom")
        .bind(Neo4jTemporalParameters.toNeo4j(validTo))
        .to("validTo")
        .fetch()
        .first()
        .map(this::mapCreateEdgeResponse)
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Echec lors de la creation de la relation."));
  }

  private boolean countIsPositive(Map<String, Object> row) {
    Object cnt = row.get("cnt");
    return cnt instanceof Number number && number.intValue() > 0;
  }

  private CreateGraphEdgeResponseDto mapCreateEdgeResponse(Map<String, Object> row) {
    return new CreateGraphEdgeResponseDto(
        row.get("id") != null ? row.get("id").toString() : null,
        row.get("sourceId") != null ? row.get("sourceId").toString() : null,
        row.get("targetId") != null ? row.get("targetId").toString() : null,
        row.get("type") != null ? row.get("type").toString() : null);
  }

  private static GraphNodeDto.TemporalDto toTemporalDto(java.time.Instant from, java.time.Instant to) {
    return new GraphNodeDto.TemporalDto(
        from != null ? from.toString() : null,
        to != null ? to.toString() : null
    );
  }
}
