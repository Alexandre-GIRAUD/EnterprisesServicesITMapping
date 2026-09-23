package com.enterprise.itmapping.feature.attributeaudit.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.OverrideConflictStatus;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeOverrideConflictEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeOverrideConflictRepository;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideRepository;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeOverrideConflictPageResponse;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeOverrideConflictResponse;
import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributePatchService;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AttributeOverrideConflictService {

  public static final int DEFAULT_PAGE_SIZE = 20;
  public static final int MAX_PAGE_SIZE = 50;

  private final AttributeOverrideConflictRepository conflictRepository;
  private final HumanFieldOverrideRepository overrideRepository;
  private final CurrentUserResolver currentUserResolver;
  private final ApplicationNodeAttributePatchService nodeAttributePatchService;
  private final GraphEdgeAttributePatchService edgeAttributePatchService;

  public AttributeOverrideConflictService(
      AttributeOverrideConflictRepository conflictRepository,
      HumanFieldOverrideRepository overrideRepository,
      CurrentUserResolver currentUserResolver,
      @Lazy ApplicationNodeAttributePatchService nodeAttributePatchService,
      @Lazy GraphEdgeAttributePatchService edgeAttributePatchService) {
    this.conflictRepository = conflictRepository;
    this.overrideRepository = overrideRepository;
    this.currentUserResolver = currentUserResolver;
    this.nodeAttributePatchService = nodeAttributePatchService;
    this.edgeAttributePatchService = edgeAttributePatchService;
  }

  @Transactional(readOnly = true)
  public AttributeOverrideConflictPageResponse list(
      OverrideConflictStatus status, int page, int size) {
    int safePage = Math.max(0, page);
    int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    PageRequest pageable = PageRequest.of(safePage, safeSize);
    Page<AttributeOverrideConflictEntity> result;
    if (status != null) {
      result = conflictRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
    } else {
      result = conflictRepository.findAllByOrderByCreatedAtDesc(pageable);
    }
    return new AttributeOverrideConflictPageResponse(
        result.getContent().stream().map(this::toResponse).toList(),
        safePage,
        safeSize,
        result.getTotalElements(),
        result.hasNext());
  }

  @Transactional(readOnly = true)
  public AttributeOverrideConflictResponse get(UUID id) {
    return toResponse(require(id));
  }

  @Transactional(readOnly = true)
  public long countPending() {
    return conflictRepository.countByStatus(OverrideConflictStatus.PENDING);
  }

  @Transactional
  public AttributeOverrideConflictResponse accept(UUID id) {
    AttributeOverrideConflictEntity conflict = requirePending(id);
    String value = conflict.getProposedValue() != null ? conflict.getProposedValue() : "";

    deleteOverride(conflict.getTargetType(), conflict.getTargetId(), conflict.getFieldKey());

    if (conflict.getFieldScope() == AuditFieldScope.NODE_ATTR) {
      nodeAttributePatchService.patchAi(
          conflict.getTargetId(), Map.of(conflict.getFieldKey(), value), "OVERRIDE_ACCEPT");
    } else if (conflict.getFieldScope() == AuditFieldScope.EDGE_ATTR) {
      edgeAttributePatchService.patchAi(
          conflict.getTargetId(), Map.of(conflict.getFieldKey(), value), "OVERRIDE_ACCEPT");
    } else {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported field scope.");
    }

    conflict.setStatus(OverrideConflictStatus.ACCEPTED);
    conflict.setResolvedAt(Instant.now());
    conflict.setResolvedByUserId(currentUserResolver.requireCurrentUser().getId());
    return toResponse(conflictRepository.save(conflict));
  }

  @Transactional
  public AttributeOverrideConflictResponse reject(UUID id) {
    AttributeOverrideConflictEntity conflict = requirePending(id);
    conflict.setStatus(OverrideConflictStatus.REJECTED);
    conflict.setResolvedAt(Instant.now());
    conflict.setResolvedByUserId(currentUserResolver.requireCurrentUser().getId());
    return toResponse(conflictRepository.save(conflict));
  }

  private void deleteOverride(AuditTargetType targetType, String targetId, String fieldKey) {
    overrideRepository
        .findByTargetTypeAndTargetIdAndFieldKey(targetType, targetId, fieldKey)
        .ifPresent(overrideRepository::delete);
  }

  private AttributeOverrideConflictEntity require(UUID id) {
    return conflictRepository
        .findById(id)
        .orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Override conflict not found."));
  }

  private AttributeOverrideConflictEntity requirePending(UUID id) {
    AttributeOverrideConflictEntity conflict = require(id);
    if (conflict.getStatus() != OverrideConflictStatus.PENDING) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Conflict is not PENDING.");
    }
    return conflict;
  }

  private AttributeOverrideConflictResponse toResponse(AttributeOverrideConflictEntity e) {
    return new AttributeOverrideConflictResponse(
        e.getId(),
        e.getTargetType(),
        e.getTargetId(),
        e.getFieldScope(),
        e.getFieldKey(),
        e.getProtectedValue(),
        e.getProposedValue(),
        e.getAiSource(),
        e.getStatus(),
        e.getCreatedAt(),
        e.getResolvedAt(),
        e.getResolvedByUserId());
  }
}
