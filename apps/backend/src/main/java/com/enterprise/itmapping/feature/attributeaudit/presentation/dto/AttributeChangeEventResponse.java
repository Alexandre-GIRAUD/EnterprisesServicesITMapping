package com.enterprise.itmapping.feature.attributeaudit.presentation.dto;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditActorType;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import java.time.Instant;
import java.util.UUID;

public record AttributeChangeEventResponse(
    UUID id,
    AuditTargetType targetType,
    String targetId,
    AuditFieldScope fieldScope,
    String fieldKey,
    String oldValue,
    String newValue,
    AuditActorType actorType,
    UUID actorUserId,
    String actorUsername,
    String aiSource,
    HumanChangeReason humanReason,
    String humanReasonComment,
    Instant createdAt) {}
