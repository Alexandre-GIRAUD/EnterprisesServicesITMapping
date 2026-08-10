package com.enterprise.itmapping.feature.changedetection.presentation.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ChangeDetectionItemDto(
    UUID id,
    String kind,
    String status,
    double confidence,
    String summary,
    List<Map<String, Object>> evidence,
    Map<String, Object> payload,
    Instant createdAt,
    Instant updatedAt) {}
