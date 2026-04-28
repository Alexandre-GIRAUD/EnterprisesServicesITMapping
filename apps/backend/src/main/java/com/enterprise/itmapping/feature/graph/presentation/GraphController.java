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

  @GetMapping
  public ResponseEntity<GraphResponseDto> getGraph(
      @RequestParam(required = false) String validAt
  ) {
    Instant pointInTime = validAt != null ? Instant.parse(validAt) : null;
    return ResponseEntity.ok(graphService.getGraph(pointInTime));
  }

  @GetMapping("/at-date")
  public ResponseEntity<GraphResponseDto> getGraphAtDate(
      @RequestParam String date
  ) {
    java.util.Date d = java.util.Date.from(java.time.Instant.parse(date));
    return ResponseEntity.ok(graphService.getGraphAtDate(d));
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
