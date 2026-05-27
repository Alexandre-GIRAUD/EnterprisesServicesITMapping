package com.enterprise.itmapping.feature.applications.presentation.dto;

/**
 * Region attached to an application via {@code IS_USED_IN}. Returned on {@code GET
 * /applications/{id}} when non-empty.
 */
public record RegionSummary(String id, String code, String name) {}
