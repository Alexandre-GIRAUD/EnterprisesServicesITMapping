package com.enterprise.itmapping.feature.attributeaudit.presentation.dto;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.OverrideConflictStatus;
import java.time.Instant;
import java.util.UUID;

public record AttributeOverrideConflictResponse(
    UUID id,
    AuditTargetType targetType,
    String targetId,
    AuditFieldScope fieldScope,
    String fieldKey,
    String protectedValue,
    String proposedValue,
    String aiSource,
    OverrideConflictStatus status,
    Instant createdAt,
    Instant resolvedAt,
    UUID resolvedByUserId) {}
