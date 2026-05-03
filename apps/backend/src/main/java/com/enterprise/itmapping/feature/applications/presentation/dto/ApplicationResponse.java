package com.enterprise.itmapping.feature.applications.presentation.dto;

import java.time.Instant;

public record ApplicationResponse(
    String id,
    String name,
    String description,
    Instant validFrom,
    Instant validTo,
    /** True when IA module suggestion must be disabled ({@code CONTAINS*} to at least one {@code Module}). */
    boolean hasModuleSubtree
) {}
