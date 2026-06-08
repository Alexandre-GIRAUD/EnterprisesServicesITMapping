package com.enterprise.itmapping.feature.graph.presentation;

import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/graph")
public class GraphController {

  private final GraphService graphService;

  public GraphController(GraphService graphService) {
    this.graphService = graphService;
  }

  /**
   * Application dependency graph for Cytoscape.
   *
   * @param year optional; when set, only applications with {@code year == value}.
   * @param applicationIds optional, repeatable; OR on application ids. Legacy {@code applicationId}
   *     accepted.
   * @param businessUnitIds optional, repeatable; OR on BU. Legacy {@code businessUnitId} accepted.
   * @param regionCodes optional, repeatable; OR on region codes. Legacy {@code regionCode}
   *     accepted. Active dimensions combine with AND.
   */
  @GetMapping
  public ResponseEntity<GraphResponseDto> getGraph(
      @RequestParam(required = false) Integer year,
      @RequestParam(required = false) List<String> applicationIds,
      @RequestParam(required = false) String applicationId,
      @RequestParam(required = false) List<String> businessUnitIds,
      @RequestParam(required = false) String businessUnitId,
      @RequestParam(required = false) List<String> regionCodes,
      @RequestParam(required = false) String regionCode
  ) {
    return ResponseEntity.ok(
        graphService.getGraph(
            year,
            mergeFilterParams(applicationIds, applicationId),
            mergeFilterParams(businessUnitIds, businessUnitId),
            mergeFilterParams(regionCodes, regionCode)));
  }

  @PostMapping("/edges")
  public ResponseEntity<CreateGraphEdgeResponseDto> createEdge(
      @Valid @RequestBody CreateGraphEdgeRequestDto request
  ) {
    CreateGraphEdgeResponseDto created = graphService.createEdge(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  /** Merges repeatable list params with optional legacy single value. */
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
