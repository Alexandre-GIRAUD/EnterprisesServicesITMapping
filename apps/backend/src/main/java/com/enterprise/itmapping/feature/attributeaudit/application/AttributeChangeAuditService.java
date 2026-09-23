package com.enterprise.itmapping.feature.attributeaudit.application;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditActorType;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeChangeEventEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeChangeEventRepository;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideRepository;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeEventResponse;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangePageResponse;
import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AttributeChangeAuditService {

  public static final int MAX_REASON_COMMENT = 1000;
  public static final int DEFAULT_PAGE_SIZE = 20;
  public static final int MAX_PAGE_SIZE = 50;

  private final AttributeChangeEventRepository eventRepository;
  private final HumanFieldOverrideRepository overrideRepository;
  private final CurrentUserResolver currentUserResolver;

  public AttributeChangeAuditService(
      AttributeChangeEventRepository eventRepository,
      HumanFieldOverrideRepository overrideRepository,
      CurrentUserResolver currentUserResolver) {
    this.eventRepository = eventRepository;
    this.overrideRepository = overrideRepository;
    this.currentUserResolver = currentUserResolver;
  }

  @Transactional(readOnly = true)
  public AttributeChangePageResponse list(
      AuditTargetType targetType, String targetId, String fieldKey, int page, int size) {
    if (!StringUtils.hasText(targetId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetId is required.");
    }
    int safePage = Math.max(0, page);
    int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    PageRequest pageable = PageRequest.of(safePage, safeSize);
    Page<AttributeChangeEventEntity> result;
    if (StringUtils.hasText(fieldKey)) {
      result =
          eventRepository.findByTargetTypeAndTargetIdAndFieldKeyOrderByCreatedAtDesc(
              targetType, targetId.trim(), fieldKey.trim(), pageable);
    } else {
      result =
          eventRepository.findByTargetTypeAndTargetIdOrderByCreatedAtDesc(
              targetType, targetId.trim(), pageable);
    }
    return new AttributeChangePageResponse(
        result.getContent().stream().map(this::toResponse).toList(),
        safePage,
        safeSize,
        result.getTotalElements(),
        result.hasNext());
  }

  /**
   * Records a single attribute change when old ≠ new. For HUMAN, upserts {@code
   * human_field_overrides}.
   *
   * @return event id, or null if no-op
   */
  @Transactional
  public UUID record(AttributeChangeRequest request) {
    String oldNorm = normalizeValue(request.oldValue());
    String newNorm = normalizeValue(request.newValue());
    if (Objects.equals(oldNorm, newNorm)) {
      return null;
    }

    AttributeChangeEventEntity event = new AttributeChangeEventEntity();
    event.setTargetType(request.targetType());
    event.setTargetId(request.targetId());
    event.setFieldScope(request.fieldScope());
    event.setFieldKey(request.fieldKey());
    event.setOldValue(oldNorm);
    event.setNewValue(newNorm);
    event.setActorType(request.actorType());
    event.setAiSource(request.aiSource());

    if (request.actorType() == AuditActorType.HUMAN) {
      HumanChangeReason reason = request.humanReason();
      if (reason == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "humanReason is required.");
      }
      String comment = normalizeComment(request.humanReasonComment());
      if (reason == HumanChangeReason.Others && !StringUtils.hasText(comment)) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "reasonComment is required when reason is Others.");
      }
      if (comment != null && comment.length() > MAX_REASON_COMMENT) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "reasonComment must be at most " + MAX_REASON_COMMENT + " characters.");
      }
      UserEntity user = currentUserResolver.requireCurrentUser();
      event.setActorUserId(user.getId());
      event.setActorUsername(user.getUsername());
      event.setHumanReason(reason);
      event.setHumanReasonComment(comment);
    } else {
      event.setHumanReason(null);
      event.setHumanReasonComment(null);
    }

    AttributeChangeEventEntity saved = eventRepository.save(event);

    if (request.actorType() == AuditActorType.HUMAN) {
      upsertOverride(saved);
    }
    return saved.getId();
  }

  /** Convenience: record many HUMAN/AI changes for the same target. */
  @Transactional
  public void recordAll(java.util.Collection<AttributeChangeRequest> requests) {
    if (requests == null) {
      return;
    }
    for (AttributeChangeRequest request : requests) {
      record(request);
    }
  }

  private void upsertOverride(AttributeChangeEventEntity event) {
    HumanFieldOverrideEntity override =
        overrideRepository
            .findByTargetTypeAndTargetIdAndFieldKey(
                event.getTargetType(), event.getTargetId(), event.getFieldKey())
            .orElseGet(HumanFieldOverrideEntity::new);
    override.setTargetType(event.getTargetType());
    override.setTargetId(event.getTargetId());
    override.setFieldKey(event.getFieldKey());
    override.setLastHumanEventId(event.getId());
    override.setProtectedValue(event.getNewValue());
    override.setHumanReason(event.getHumanReason());
    override.setHumanReasonComment(event.getHumanReasonComment());
    overrideRepository.save(override);
  }

  private AttributeChangeEventResponse toResponse(AttributeChangeEventEntity e) {
    return new AttributeChangeEventResponse(
        e.getId(),
        e.getTargetType(),
        e.getTargetId(),
        e.getFieldScope(),
        e.getFieldKey(),
        e.getOldValue(),
        e.getNewValue(),
        e.getActorType(),
        e.getActorUserId(),
        e.getActorUsername(),
        e.getAiSource(),
        e.getHumanReason(),
        e.getHumanReasonComment(),
        e.getCreatedAt());
  }

  private static String normalizeValue(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private static String normalizeComment(String comment) {
    if (comment == null) {
      return null;
    }
    String trimmed = comment.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  public record AttributeChangeRequest(
      AuditTargetType targetType,
      String targetId,
      AuditFieldScope fieldScope,
      String fieldKey,
      String oldValue,
      String newValue,
      AuditActorType actorType,
      HumanChangeReason humanReason,
      String humanReasonComment,
      String aiSource) {

    public static AttributeChangeRequest human(
        AuditTargetType targetType,
        String targetId,
        AuditFieldScope fieldScope,
        String fieldKey,
        String oldValue,
        String newValue,
        HumanChangeReason reason,
        String reasonComment) {
      return new AttributeChangeRequest(
          targetType,
          targetId,
          fieldScope,
          fieldKey,
          oldValue,
          newValue,
          AuditActorType.HUMAN,
          reason,
          reasonComment,
          null);
    }

    public static AttributeChangeRequest ai(
        AuditTargetType targetType,
        String targetId,
        AuditFieldScope fieldScope,
        String fieldKey,
        String oldValue,
        String newValue,
        String aiSource) {
      return new AttributeChangeRequest(
          targetType,
          targetId,
          fieldScope,
          fieldKey,
          oldValue,
          newValue,
          AuditActorType.AI,
          null,
          null,
          aiSource);
    }
  }
}
