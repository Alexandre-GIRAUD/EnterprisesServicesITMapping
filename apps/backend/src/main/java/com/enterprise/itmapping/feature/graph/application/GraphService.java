package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.GraphLoader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GraphService {

  private static final Logger log = LoggerFactory.getLogger(GraphService.class);

  private static final Set<String> ALLOWED_EDGE_TYPES = Set.of("DEPENDS_ON", "CONTAINS");

  private final GraphLoader graphLoader;
  private final Neo4jClient neo4jClient;
  private final ApplicationRepository applicationRepository;
  private final DataModelService dataModelService;
  private final GraphNodeFilterResolver nodeFilterResolver;

  public GraphService(
      GraphLoader graphLoader,
      Neo4jClient neo4jClient,
      ApplicationRepository applicationRepository,
      DataModelService dataModelService,
      GraphNodeFilterResolver nodeFilterResolver
  ) {
    this.graphLoader = graphLoader;
    this.neo4jClient = neo4jClient;
    this.applicationRepository = applicationRepository;
    this.dataModelService = dataModelService;
    this.nodeFilterResolver = nodeFilterResolver;
  }

  /**
   * @param applicationIds optional; when non-empty, only listed application ids (OR).
   * @param nodeAttributeFilters optional; Data Model {@code target=NODE} key → accepted values.
   * @param nodeRefFilters optional; Data Model {@code target=NODE_REF} key → ref ids.
   */
  @Transactional(readOnly = true)
  public GraphResponseDto getGraph(
      List<String> applicationIds,
      Map<String, List<String>> nodeAttributeFilters,
      Map<String, List<String>> nodeRefFilters) {
    List<String> appIds = resolveExistingApplicationIds(applicationIds);
    GraphNodeFilterResolver.Resolved resolved =
        nodeFilterResolver.resolve(
            dataModelService.loadConfig(), nodeAttributeFilters, nodeRefFilters);

    log.info(
        "Graph load: applicationIds={} nodeFilterKeys={} nodeRefKeys={}",
        appIds != null ? appIds.size() : 0,
        resolved.nodeAttributes().keySet(),
        resolved.nodeRefs().keySet());
    if (!resolved.rejectedKeys().isEmpty()) {
      log.debug(
          "Graph load ignored filter keys (not in Data Model NODE/NODE_REF fields): {}",
          resolved.rejectedKeys());
    }

    if (appIds != null && appIds.isEmpty()) {
      return new GraphResponseDto(List.of(), List.of());
    }

    Map<String, List<String>> attrFilters = resolved.nodeAttributes();
    Map<String, List<String>> refFilters = resolved.nodeRefs();
    List<GraphEdgeProjection> edges = graphLoader.loadEdges(appIds, attrFilters, refFilters);

    List<GraphNodeDto> nodes =
        graphLoader.loadNodes(appIds, attrFilters, refFilters).stream()
            .map(
                a ->
                    new GraphNodeDto(
                        a.id(),
                        a.name() != null ? a.name() : a.id(),
                        "Application",
                        null,
                        a.properties()))
            .collect(Collectors.toList());

    List<GraphEdgeDto> edgeDtos = new ArrayList<>();
    int i = 0;
    for (GraphEdgeProjection e : edges) {
      String id =
          e.relationshipId() != null && !e.relationshipId().isBlank()
              ? e.relationshipId()
              : "e" + (i++);
      edgeDtos.add(
          new GraphEdgeDto(
              id, e.sourceId(), e.targetId(), e.type(), e.data(), e.properties()));
    }

    return new GraphResponseDto(nodes, edgeDtos);
  }

  /** Backward-compatible overload (no NODE_REF filters). */
  @Transactional(readOnly = true)
  public GraphResponseDto getGraph(
      List<String> applicationIds, Map<String, List<String>> nodeAttributeFilters) {
    return getGraph(applicationIds, nodeAttributeFilters, Map.of());
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
          HttpStatus.CONFLICT, "Une relation identique existe deja.");
    }

    String edgeId = UUID.randomUUID().toString();
    String createCypher =
        """
        MATCH (s:Application {id: $sourceId})
        MATCH (t:Application {id: $targetId})
        CREATE (s)-[r:%s]->(t)
        SET r.id = $edgeId
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
}
