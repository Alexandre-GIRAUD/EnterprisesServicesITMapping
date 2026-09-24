package com.enterprise.itmapping.feature.graph.presentation;

import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributePatchService;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeLinkService;
import com.enterprise.itmapping.feature.graph.application.GraphNeighborhoodService;
import com.enterprise.itmapping.feature.graph.application.GraphNodeFilterFacetService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.domain.NeighborhoodDirection;
import com.enterprise.itmapping.feature.graph.presentation.dto.GraphEdgeAttributesPatchRequest;
import com.enterprise.itmapping.feature.graph.presentation.dto.GraphEdgeDeleteRequest;
import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/graph")
public class GraphController {

  /** Prefix carrying one Data Model NODE attribute filter, e.g. {@code attr.tier=GOLD}. */
  static final String NODE_ATTRIBUTE_PARAM_PREFIX = "attr.";

  /** Prefix carrying one Data Model NODE_REF filter, e.g. {@code ref.tier_ref=<refId>}. */
  static final String NODE_REF_PARAM_PREFIX = "ref.";

  /** Prefix carrying one Data Model EDGE attribute filter, e.g. {@code edge.data_category=X}. */
  static final String EDGE_ATTRIBUTE_PARAM_PREFIX = "edge.";

  private final GraphService graphService;
  private final GraphNodeFilterFacetService nodeFilterFacetService;
  private final GraphEdgeAttributePatchService edgeAttributePatchService;
  private final GraphEdgeLinkService edgeLinkService;
  private final GraphNeighborhoodService neighborhoodService;

  public GraphController(
      GraphService graphService,
      GraphNodeFilterFacetService nodeFilterFacetService,
      GraphEdgeAttributePatchService edgeAttributePatchService,
      GraphEdgeLinkService edgeLinkService,
      GraphNeighborhoodService neighborhoodService) {
    this.graphService = graphService;
    this.nodeFilterFacetService = nodeFilterFacetService;
    this.edgeAttributePatchService = edgeAttributePatchService;
    this.edgeLinkService = edgeLinkService;
    this.neighborhoodService = neighborhoodService;
  }

  /**
   * Application dependency graph for the map.
   *
   * <ul>
   *   <li>{@code applicationIds} (repeatable);
   *   <li>{@code attr.<nodeKey>} — flat NODE props;
   *   <li>{@code ref.<nodeRefKey>} — NODE_REF catalogue ids via {@code CLASSIFIED_AS};
   *   <li>{@code edge.<edgeKey>} — flat EDGE props on {@code DEPENDS_ON}; when set, only apps
   *       incident to a matching edge remain.
   * </ul>
   */
  @GetMapping
  public ResponseEntity<GraphResponseDto> getGraph(
      @RequestParam(required = false) List<String> applicationIds,
      @RequestParam(required = false) String applicationId,
      @RequestParam MultiValueMap<String, String> allParams
  ) {
    return ResponseEntity.ok(
        graphService.getGraph(
            mergeFilterParams(applicationIds, applicationId),
            prefixedFilters(allParams, NODE_ATTRIBUTE_PARAM_PREFIX),
            prefixedFilters(allParams, NODE_REF_PARAM_PREFIX),
            prefixedFilters(allParams, EDGE_ATTRIBUTE_PARAM_PREFIX)));
  }

  /**
   * Filterable dimensions for the map menu: Data Model {@code NODE}, {@code NODE_REF} and {@code
   * EDGE} fields ({@code kind} discriminates). Historical path name retained for UI compatibility.
   */
  @GetMapping("/node-filters")
  public List<GraphNodeFilterDto> nodeFilters() {
    return nodeFilterFacetService.listNodeFilters();
  }

  /**
   * Incident {@code DEPENDS_ON} neighborhood for one application (OUT / IN / BOTH). Unlike {@code
   * GET /graph?applicationIds=}, both ends of each edge need not be in a closed filter set.
   */
  @GetMapping("/applications/{id}/neighborhood")
  public ApplicationNeighborhoodDto neighborhood(
      @PathVariable String id,
      @RequestParam(required = false, defaultValue = "BOTH") String direction,
      @RequestParam(required = false, defaultValue = "50") int maxEdges) {
    NeighborhoodDirection dir;
    try {
      dir = NeighborhoodDirection.fromParam(direction);
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "direction must be BOTH, OUT, or IN.");
    }
    return neighborhoodService.getNeighborhood(id, dir, maxEdges);
  }

  @PostMapping("/edges")
  public ResponseEntity<CreateGraphEdgeResponseDto> createEdge(
      @Valid @RequestBody CreateGraphEdgeRequestDto request
  ) {
    CreateGraphEdgeResponseDto created = graphService.createEdge(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  /**
   * Partially updates Data Model {@code target=EDGE} attributes on a {@code DEPENDS_ON}
   * relationship. Blank values clear the property. Human edits require {@code changeMeta}.
   */
  @PatchMapping("/edges/{id}/attributes")
  public ResponseEntity<Map<String, String>> patchEdgeAttributes(
      @PathVariable String id,
      @RequestBody(required = false) GraphEdgeAttributesPatchRequest body) {
    Map<String, String> attributes = body != null ? body.attributes() : Map.of();
    Map<String, String> updated;
    if (body != null && body.changeMeta() != null) {
      updated = edgeAttributePatchService.patchHuman(id, attributes, body.changeMeta());
    } else {
      updated = edgeAttributePatchService.patchAi(id, attributes, "API_PATCH");
    }
    return ResponseEntity.ok(updated);
  }

  /**
   * Deletes a graph edge and records an {@code EDGE_LINK} audit event. Human deletes require
   * {@code changeMeta.reason}.
   */
  @DeleteMapping("/edges/{id}")
  public ResponseEntity<Void> deleteEdge(
      @PathVariable String id,
      @RequestBody(required = false) GraphEdgeDeleteRequest body) {
    if (body != null && body.changeMeta() != null) {
      edgeLinkService.deleteHuman(id, body.changeMeta());
    } else {
      edgeLinkService.deleteAi(id, "API_DELETE");
    }
    return ResponseEntity.noContent().build();
  }

  static Map<String, List<String>> nodeAttributeFilters(MultiValueMap<String, String> allParams) {
    return prefixedFilters(allParams, NODE_ATTRIBUTE_PARAM_PREFIX);
  }

  static Map<String, List<String>> nodeRefFilters(MultiValueMap<String, String> allParams) {
    return prefixedFilters(allParams, NODE_REF_PARAM_PREFIX);
  }

  static Map<String, List<String>> edgeAttributeFilters(MultiValueMap<String, String> allParams) {
    return prefixedFilters(allParams, EDGE_ATTRIBUTE_PARAM_PREFIX);
  }

  static Map<String, List<String>> prefixedFilters(
      MultiValueMap<String, String> allParams, String prefix) {
    Map<String, List<String>> out = new LinkedHashMap<>();
    if (allParams == null) {
      return out;
    }
    for (Map.Entry<String, List<String>> entry : allParams.entrySet()) {
      String name = entry.getKey();
      if (name == null || !name.startsWith(prefix)) {
        continue;
      }
      String key = name.substring(prefix.length()).trim();
      if (key.isEmpty()) {
        continue;
      }
      List<String> values = new ArrayList<>(out.getOrDefault(key, List.of()));
      for (String value : entry.getValue()) {
        if (value != null && !value.isBlank()) {
          values.add(value.trim());
        }
      }
      if (!values.isEmpty()) {
        out.put(key, values);
      }
    }
    return out;
  }

  static List<String> mergeFilterParams(List<String> plural, String singular) {
    List<String> merged = new ArrayList<>();
    if (plural != null) {
      for (String value : plural) {
        if (value != null && !value.isBlank()) {
          merged.add(value.trim());
        }
      }
    }
    if (singular != null && !singular.isBlank()) {
      merged.add(singular.trim());
    }
    return merged.isEmpty() ? null : merged;
  }
}
