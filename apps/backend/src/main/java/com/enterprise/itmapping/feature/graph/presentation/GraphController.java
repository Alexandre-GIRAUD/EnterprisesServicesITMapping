package com.enterprise.itmapping.feature.graph.presentation;

import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.VersionSnapshotDto;
import jakarta.validation.Valid;
import java.time.Instant;
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
   * @param validAt optional point-in-time (ISO instant)
   * @param applicationIds optional, repeatable; OR on application ids. Legacy {@code applicationId}
   *     accepted.
   * @param businessUnitIds optional, repeatable; OR on BU. Legacy {@code businessUnitId} accepted.
   * @param regionCodes optional, repeatable; OR on region codes. Legacy {@code regionCode}
   *     accepted. Active dimensions combine with AND.
   */
  @GetMapping
  public ResponseEntity<GraphResponseDto> getGraph(
      @RequestParam(required = false) String validAt,
      @RequestParam(required = false) List<String> applicationIds,
      @RequestParam(required = false) String applicationId,
      @RequestParam(required = false) List<String> businessUnitIds,
      @RequestParam(required = false) String businessUnitId,
      @RequestParam(required = false) List<String> regionCodes,
      @RequestParam(required = false) String regionCode
  ) {
    Instant pointInTime = validAt != null ? Instant.parse(validAt) : null;
    return ResponseEntity.ok(
        graphService.getGraph(
            pointInTime,
            mergeFilterParams(applicationIds, applicationId),
            mergeFilterParams(businessUnitIds, businessUnitId),
            mergeFilterParams(regionCodes, regionCode)));
  }

  @GetMapping("/at-date")
  public ResponseEntity<GraphResponseDto> getGraphAtDate(
      @RequestParam String date,
      @RequestParam(required = false) List<String> applicationIds,
      @RequestParam(required = false) String applicationId,
      @RequestParam(required = false) List<String> businessUnitIds,
      @RequestParam(required = false) String businessUnitId,
      @RequestParam(required = false) List<String> regionCodes,
      @RequestParam(required = false) String regionCode
  ) {
    java.util.Date d = java.util.Date.from(java.time.Instant.parse(date));
    return ResponseEntity.ok(
        graphService.getGraphAtDate(
            d,
            mergeFilterParams(applicationIds, applicationId),
            mergeFilterParams(businessUnitIds, businessUnitId),
            mergeFilterParams(regionCodes, regionCode)));
  }

  @PostMapping("/snapshots")
  public ResponseEntity<VersionSnapshotDto> createSnapshot(
      @RequestBody CreateSnapshotRequest request
  ) {
    VersionSnapshotDto created = graphService.createNewSnapshot(request.versionName());
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
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

  public record CreateSnapshotRequest(String versionName) {}
}
