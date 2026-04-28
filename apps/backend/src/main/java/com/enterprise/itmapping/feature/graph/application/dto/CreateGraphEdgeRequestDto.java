package com.enterprise.itmapping.feature.graph.application.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

public record CreateGraphEdgeRequestDto(
    @NotBlank String sourceId,
    @NotBlank String targetId,
    @NotBlank String type,
    Instant validFrom,
    Instant validTo
) {}
