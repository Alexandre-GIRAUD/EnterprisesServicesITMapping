package com.enterprise.itmapping.feature.attributeaudit.application;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditActorType;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeChangeEventEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeChangeEventRepository;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.EdgeEndpointLookup;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideRepository;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeEventResponse;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangePageResponse;
import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
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

  /** Actor label for lifecycle changes made with nobody signed in. */
  public static final String SYSTEM_SOURCE = "SYSTEM";

  private static final Instant NO_LOWER_BOUND = Instant.EPOCH;
  private static final Instant NO_UPPER_BOUND = Instant.parse("9999-12-31T00:00:00Z");

  private final AttributeChangeEventRepository eventRepository;
  private final HumanFieldOverrideRepository overrideRepository;
  private final CurrentUserResolver currentUserResolver;
  private final EdgeEndpointLookup edgeEndpointLookup;

  public AttributeChangeAuditService(
      AttributeChangeEventRepository eventRepository,
      HumanFieldOverrideRepository overrideRepository,
      CurrentUserResolver currentUserResolver,
      EdgeEndpointLookup edgeEndpointLookup) {
    this.eventRepository = eventRepository;
    this.overrideRepository = overrideRepository;
    this.currentUserResolver = currentUserResolver;
    this.edgeEndpointLookup = edgeEndpointLookup;
  }

  /** Everything that happened to one application, its modules and its flows, newest first. */
  @Transactional(readOnly = true)
  public AttributeChangePageResponse listForApplication(
      String applicationId, LocalDate fromDay, LocalDate toDay, int page, int size) {
    if (!StringUtils.hasText(applicationId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "applicationId is required.");
    }
    int safePage = Math.max(0, page);
    int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    Instant from = fromDay == null ? NO_LOWER_BOUND : startOf(fromDay);
    Instant to = toDay == null ? NO_UPPER_BOUND : startOf(toDay.plusDays(1));
    Page<AttributeChangeEventEntity> result =
        eventRepository.findForApplication(
            applicationId.trim(), from, to, PageRequest.of(safePage, safeSize));
    return new AttributeChangePageResponse(
        result.getContent().stream().map(this::toResponse).toList(),
        safePage,
        safeSize,
        result.getTotalElements(),
        result.hasNext());
  }

  /**
   * Creation, deletion or rename of an application or module. No reason is asked: the signed-in
   * user is the actor, or {@link #SYSTEM_SOURCE} when nobody is.
   *
   * @return event id, or null if no-op
   */
  @Transactional
  public UUID recordLifecycle(LifecycleChange change) {
    String oldNorm = normalizeValue(change.oldValue());
    String newNorm = normalizeValue(change.newValue());
    if (Objects.equals(oldNorm, newNorm)) {
      return null;
    }
    AttributeChangeEventEntity event = new AttributeChangeEventEntity();
    event.setTargetType(change.targetType());
    event.setTargetId(change.targetId());
    event.setFieldScope(change.fieldScope());
    event.setFieldKey(change.fieldKey());
    event.setOldValue(oldNorm);
    event.setNewValue(newNorm);
    event.setApplicationIds(change.applicationIds());
    Optional<UserEntity> user = currentUserResolver.findCurrentUser();
    event.setActorType(user.isPresent() ? AuditActorType.HUMAN : AuditActorType.AI);
    event.setActorUserId(user.map(UserEntity::getId).orElse(null));
    event.setActorUsername(user.map(UserEntity::getUsername).orElse(null));
    event.setAiSource(user.isPresent() ? null : SYSTEM_SOURCE);
    return eventRepository.save(event).getId();
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
    event.setApplicationIds(applicationIdsOf(request.targetType(), request.targetId()));

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

  private List<String> applicationIdsOf(AuditTargetType targetType, String targetId) {
    return switch (targetType) {
      case APPLICATION -> List.of(targetId);
      case EDGE -> edgeEndpointLookup.applicationIds(targetId);
      case MODULE -> List.of();
    };
  }

  private static Instant startOf(LocalDate day) {
    return day.atStartOfDay(ZoneOffset.UTC).toInstant();
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

  public record LifecycleChange(
      AuditTargetType targetType,
      String targetId,
      AuditFieldScope fieldScope,
      String fieldKey,
      String oldValue,
      String newValue,
      List<String> applicationIds) {}

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
