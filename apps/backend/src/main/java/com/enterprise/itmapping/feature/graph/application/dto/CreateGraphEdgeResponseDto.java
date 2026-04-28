package com.enterprise.itmapping.feature.graph.application.dto;

public record CreateGraphEdgeResponseDto(
    String id,
    String sourceId,
    String targetId,
    String type
) {}
