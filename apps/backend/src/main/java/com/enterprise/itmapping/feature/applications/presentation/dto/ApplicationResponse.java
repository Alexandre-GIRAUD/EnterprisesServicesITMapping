package com.enterprise.itmapping.feature.applications.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

public record ApplicationResponse(
    String id,
    String name,
    String description,
    Instant validFrom,
    Instant validTo,
    /** True when IA module suggestion must be disabled ({@code CONTAINS*} to at least one {@code Module}). */
    boolean hasModuleSubtree,
    /** Present on {@code GET /applications/{id}} when the app is linked to a BU; otherwise null. */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    BusinessUnitSummary businessUnit
) {}
