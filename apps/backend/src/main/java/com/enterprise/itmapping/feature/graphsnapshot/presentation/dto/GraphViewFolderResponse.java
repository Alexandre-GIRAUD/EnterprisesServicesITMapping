package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import java.time.Instant;
import java.util.UUID;

public record GraphViewFolderResponse(
    UUID id, String name, UUID parentId, Instant createdAt, Instant updatedAt) {}
