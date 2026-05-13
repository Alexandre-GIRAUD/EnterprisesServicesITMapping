package com.enterprise.itmapping.feature.contributors.presentation.dto;

/** Embedded on {@code GET /applications/{id}} and manager summary on contributor detail. */
public record ContributorSummaryDto(String id, String firstName, String lastName) {}
