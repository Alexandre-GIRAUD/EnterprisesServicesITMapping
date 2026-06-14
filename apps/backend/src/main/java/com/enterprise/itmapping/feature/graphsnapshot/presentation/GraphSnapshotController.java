package com.enterprise.itmapping.feature.graphsnapshot.presentation;

import com.enterprise.itmapping.feature.graphsnapshot.application.GraphSnapshotService;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.CreateGraphSnapshotRequest;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphSnapshotResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users/me/graph-snapshots")
public class GraphSnapshotController {

  private final GraphSnapshotService graphSnapshotService;

  public GraphSnapshotController(GraphSnapshotService graphSnapshotService) {
    this.graphSnapshotService = graphSnapshotService;
  }

  @GetMapping
  public List<GraphSnapshotResponse> list() {
    return graphSnapshotService.listForCurrentUser();
  }

  @PostMapping
  public ResponseEntity<GraphSnapshotResponse> create(
      @Valid @RequestBody CreateGraphSnapshotRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(graphSnapshotService.create(request));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    graphSnapshotService.deleteForCurrentUser(id);
    return ResponseEntity.noContent().build();
  }
}
