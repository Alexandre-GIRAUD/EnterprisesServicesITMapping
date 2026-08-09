package com.enterprise.itmapping.feature.changedetection.presentation.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ChangeDetectionRunDto(
    UUID id,
    String provider,
    String repoFullName,
    String commitSha,
    String branchRef,
    String applicationId,
    String status,
    boolean truncated,
    List<String> buckets,
    List<Map<String, Object>> files,
    String errorMessage,
    List<ChangeDetectionItemDto> items,
    Instant createdAt,
    Instant updatedAt) {}
