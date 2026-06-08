package com.enterprise.itmapping.feature.graph.application.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateGraphEdgeRequestDto(
    @NotBlank String sourceId,
    @NotBlank String targetId,
    @NotBlank String type
) {}
