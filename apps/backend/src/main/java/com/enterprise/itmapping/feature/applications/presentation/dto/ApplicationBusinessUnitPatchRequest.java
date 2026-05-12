package com.enterprise.itmapping.feature.applications.presentation.dto;

/**
 * PATCH body for {@code /applications/{id}/business-unit}. {@code businessUnitId} {@code null}
 * clears any {@code HAS_APPLICATION} link to this application.
 */
public record ApplicationBusinessUnitPatchRequest(String businessUnitId) {}
