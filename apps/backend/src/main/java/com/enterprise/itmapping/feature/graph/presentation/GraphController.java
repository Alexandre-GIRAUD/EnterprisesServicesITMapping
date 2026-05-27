package com.enterprise.itmapping.feature.graph.presentation;

import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.VersionSnapshotDto;
import jakarta.validation.Valid;
import java.time.Instant;
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
   * @param businessUnitId optional; when set, only applications linked via {@code
   *     (:BusinessUnit)-[:HAS_APPLICATION]->(:Application)} for that id are returned, with {@code
   *     DEPENDS_ON} edges between those apps only. Unknown id yields an empty graph. The BU node is
   *     never part of the JSON payload.
   * @param regionCode optional; when set, only applications with {@code
   *     (:Application)-[:IS_USED_IN]->(:Region)} for that {@code Region.code} are returned (match
   *     case-insensitive). Unknown code yields an empty graph. {@code Region} nodes are never part
   *     of the JSON payload. When combined with {@code businessUnitId}, both filters apply (AND).
   */
  @GetMapping
  public ResponseEntity<GraphResponseDto> getGraph(
      @RequestParam(required = false) String validAt,
      @RequestParam(required = false) String businessUnitId,
      @RequestParam(required = false) String regionCode
  ) {
    Instant pointInTime = validAt != null ? Instant.parse(validAt) : null;
    return ResponseEntity.ok(graphService.getGraph(pointInTime, businessUnitId, regionCode));
  }

  @GetMapping("/at-date")
  public ResponseEntity<GraphResponseDto> getGraphAtDate(
      @RequestParam String date,
      @RequestParam(required = false) String businessUnitId,
      @RequestParam(required = false) String regionCode
  ) {
    java.util.Date d = java.util.Date.from(java.time.Instant.parse(date));
    return ResponseEntity.ok(graphService.getGraphAtDate(d, businessUnitId, regionCode));
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

  public record CreateSnapshotRequest(String versionName) {}
}
