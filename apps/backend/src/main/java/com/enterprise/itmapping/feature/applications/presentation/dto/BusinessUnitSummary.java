package com.enterprise.itmapping.feature.applications.presentation.dto;

/**
 * Business unit attached to an application via {@code HAS_APPLICATION} (see Neo4j model).
 * Returned on application detail; omitted or null on list endpoints when not loaded.
 */
public record BusinessUnitSummary(
    String id, String name, String code, String description) {}
