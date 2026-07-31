package com.enterprise.itmapping.feature.graph.presentation;

import com.enterprise.itmapping.feature.graph.application.GraphNodeFilterFacetService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/graph")
public class GraphController {

  /** Prefix carrying one Data Model NODE attribute filter, e.g. {@code attr.tier=GOLD}. */
  static final String NODE_ATTRIBUTE_PARAM_PREFIX = "attr.";

  /** Prefix carrying one Data Model NODE_REF filter, e.g. {@code ref.tier_ref=<refId>}. */
  static final String NODE_REF_PARAM_PREFIX = "ref.";

  private final GraphService graphService;
  private final GraphNodeFilterFacetService nodeFilterFacetService;

  public GraphController(
      GraphService graphService, GraphNodeFilterFacetService nodeFilterFacetService) {
    this.graphService = graphService;
    this.nodeFilterFacetService = nodeFilterFacetService;
  }

  /**
   * Application dependency graph for the map.
   *
   * <ul>
   *   <li>{@code applicationIds} (repeatable);
   *   <li>{@code attr.<nodeKey>} — flat NODE props;
   *   <li>{@code ref.<nodeRefKey>} — NODE_REF catalogue ids via {@code CLASSIFIED_AS}.
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
            prefixedFilters(allParams, NODE_REF_PARAM_PREFIX)));
  }

  /** Filterable dimensions: Data Model NODE + NODE_REF fields. */
  @GetMapping("/node-filters")
  public List<GraphNodeFilterDto> nodeFilters() {
    return nodeFilterFacetService.listNodeFilters();
  }

  @PostMapping("/edges")
  public ResponseEntity<CreateGraphEdgeResponseDto> createEdge(
      @Valid @RequestBody CreateGraphEdgeRequestDto request
  ) {
    CreateGraphEdgeResponseDto created = graphService.createEdge(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  static Map<String, List<String>> nodeAttributeFilters(MultiValueMap<String, String> allParams) {
    return prefixedFilters(allParams, NODE_ATTRIBUTE_PARAM_PREFIX);
  }

  static Map<String, List<String>> nodeRefFilters(MultiValueMap<String, String> allParams) {
    return prefixedFilters(allParams, NODE_REF_PARAM_PREFIX);
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
