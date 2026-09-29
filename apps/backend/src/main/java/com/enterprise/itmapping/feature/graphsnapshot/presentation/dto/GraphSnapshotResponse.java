package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import java.time.Instant;
import java.util.UUID;

public record GraphSnapshotResponse(
    UUID id,
    String name,
    GraphSnapshotFiltersDto filters,
    Instant createdAt,
    Instant updatedAt,
    UUID folderId) {

  public GraphSnapshotResponse(
      UUID id,
      String name,
      GraphSnapshotFiltersDto filters,
      Instant createdAt,
      Instant updatedAt) {
    this(id, name, filters, createdAt, updatedAt, null);
  }
}
