package com.enterprise.itmapping.feature.applications.presentation.dto;

import java.time.Instant;

public record ApplicationResponse(
    String id,
    String name,
    String description,
    Instant validFrom,
    Instant validTo
) {}
