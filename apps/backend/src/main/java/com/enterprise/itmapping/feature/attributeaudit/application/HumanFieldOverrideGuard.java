package com.enterprise.itmapping.feature.attributeaudit.application;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.OverrideConflictStatus;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeOverrideConflictEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeOverrideConflictRepository;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideRepository;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Gates AI attribute writes against {@code human_field_overrides}. On conflict, enqueues a PENDING
 * item for the Changes UI and blocks the Neo4j write for that field.
 */
@Service
public class HumanFieldOverrideGuard {

  private static final Logger log = LoggerFactory.getLogger(HumanFieldOverrideGuard.class);

  public enum Decision {
    ALLOW,
    BLOCK_AND_ENQUEUE
  }

  private final HumanFieldOverrideRepository overrideRepository;
  private final AttributeOverrideConflictRepository conflictRepository;

  public HumanFieldOverrideGuard(
      HumanFieldOverrideRepository overrideRepository,
      AttributeOverrideConflictRepository conflictRepository) {
    this.overrideRepository = overrideRepository;
    this.conflictRepository = conflictRepository;
  }

  /**
   * @param proposedValue raw proposed value (blank / empty treated as clear → null)
   * @return ALLOW if Neo4j write may proceed; BLOCK_AND_ENQUEUE if blocked (conflict queued)
   */
  @Transactional
  public Decision checkAiWrite(
      AuditTargetType targetType,
      String targetId,
      AuditFieldScope fieldScope,
      String fieldKey,
      String proposedValue,
      String aiSource) {
    if (targetType == null
        || !StringUtils.hasText(targetId)
        || fieldScope == null
        || !StringUtils.hasText(fieldKey)) {
      return Decision.ALLOW;
    }
    if (fieldScope != AuditFieldScope.NODE_ATTR && fieldScope != AuditFieldScope.EDGE_ATTR) {
      return Decision.ALLOW;
    }

    String proposed = normalize(proposedValue);
    Optional<HumanFieldOverrideEntity> overrideOpt =
        overrideRepository.findByTargetTypeAndTargetIdAndFieldKey(
            targetType, targetId.trim(), fieldKey.trim());
    if (overrideOpt.isEmpty()) {
      return Decision.ALLOW;
    }

    HumanFieldOverrideEntity override = overrideOpt.get();
    String protectedValue = normalize(override.getProtectedValue());
    if (Objects.equals(protectedValue, proposed)) {
      return Decision.ALLOW;
    }

    enqueueConflict(
        targetType,
        targetId.trim(),
        fieldScope,
        fieldKey.trim(),
        protectedValue,
        proposed,
        aiSource);
    log.info(
        "AI write blocked by human override targetType={} targetId={} field={} aiSource={}",
        targetType,
        targetId,
        fieldKey,
        aiSource);
    return Decision.BLOCK_AND_ENQUEUE;
  }

  private void enqueueConflict(
      AuditTargetType targetType,
      String targetId,
      AuditFieldScope fieldScope,
      String fieldKey,
      String protectedValue,
      String proposedValue,
      String aiSource) {
    Optional<AttributeOverrideConflictEntity> existing =
        conflictRepository.findByTargetTypeAndTargetIdAndFieldKeyAndStatus(
            targetType, targetId, fieldKey, OverrideConflictStatus.PENDING);
    if (existing.isPresent()) {
      AttributeOverrideConflictEntity open = existing.get();
      if (Objects.equals(normalize(open.getProposedValue()), proposedValue)) {
        return;
      }
      open.setProposedValue(proposedValue);
      open.setProtectedValue(protectedValue);
      open.setAiSource(aiSource);
      conflictRepository.save(open);
      return;
    }

    AttributeOverrideConflictEntity conflict = new AttributeOverrideConflictEntity();
    conflict.setTargetType(targetType);
    conflict.setTargetId(targetId);
    conflict.setFieldScope(fieldScope);
    conflict.setFieldKey(fieldKey);
    conflict.setProtectedValue(protectedValue);
    conflict.setProposedValue(proposedValue);
    conflict.setAiSource(aiSource);
    conflict.setStatus(OverrideConflictStatus.PENDING);
    conflictRepository.save(conflict);
  }

  static String normalize(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
