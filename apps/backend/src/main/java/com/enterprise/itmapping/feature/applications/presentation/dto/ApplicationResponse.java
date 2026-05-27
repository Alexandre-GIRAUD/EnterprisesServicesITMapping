package com.enterprise.itmapping.feature.applications.presentation.dto;

import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorSummaryDto;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

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
    BusinessUnitSummary businessUnit,
    /**
     * Contributors with {@code WORK_ON} to this application (detail only; omitted when empty for
     * compact JSON).
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    List<ContributorSummaryDto> contributors,
    /**
     * Regions linked via {@code IS_USED_IN} ({@code GET /applications/{id}} only when non-empty;
     * list endpoint omits).
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    List<RegionSummary> regions
) {}
