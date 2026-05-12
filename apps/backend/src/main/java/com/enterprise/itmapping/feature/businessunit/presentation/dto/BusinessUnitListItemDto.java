package com.enterprise.itmapping.feature.businessunit.presentation.dto;

/** Minimal payload for filter dropdowns (GET /business-units). */
public record BusinessUnitListItemDto(String id, String name) {}
