package com.enterprise.itmapping.feature.graphsnapshot.presentation;

import com.enterprise.itmapping.feature.graphsnapshot.application.GraphViewFolderService;
import com.enterprise.itmapping.feature.graphsnapshot.application.ShareLibraryService;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.CreateGraphViewFolderRequest;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphViewFolderResponse;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.MoveGraphViewFolderRequest;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.RenameGraphSnapshotRequest;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.ShareWithUserRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users/me/graph-view-folders")
public class GraphViewFolderController {

  private final GraphViewFolderService graphViewFolderService;
  private final ShareLibraryService shareLibraryService;

  public GraphViewFolderController(
      GraphViewFolderService graphViewFolderService, ShareLibraryService shareLibraryService) {
    this.graphViewFolderService = graphViewFolderService;
    this.shareLibraryService = shareLibraryService;
  }

  @GetMapping
  public List<GraphViewFolderResponse> list() {
    return graphViewFolderService.listForCurrentUser();
  }

  @PostMapping
  public ResponseEntity<GraphViewFolderResponse> create(
      @Valid @RequestBody CreateGraphViewFolderRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(graphViewFolderService.create(request.name(), request.parentId()));
  }

  @PatchMapping("/{id}")
  public GraphViewFolderResponse rename(
      @PathVariable UUID id, @Valid @RequestBody RenameGraphSnapshotRequest request) {
    return graphViewFolderService.rename(id, request.name());
  }

  @PatchMapping("/{id}/parent")
  public GraphViewFolderResponse move(
      @PathVariable UUID id, @RequestBody MoveGraphViewFolderRequest request) {
    return graphViewFolderService.move(id, request.parentId());
  }

  @PostMapping("/{id}/share")
  public ResponseEntity<Void> share(
      @PathVariable UUID id, @Valid @RequestBody ShareWithUserRequest request) {
    shareLibraryService.shareFolder(id, request.username());
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    graphViewFolderService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
