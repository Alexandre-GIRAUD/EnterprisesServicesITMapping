package com.enterprise.itmapping.feature.attributeaudit.presentation.dto;

import java.util.List;

public record AttributeOverrideConflictPageResponse(
    List<AttributeOverrideConflictResponse> items,
    int page,
    int size,
    long totalElements,
    boolean hasMore) {}
