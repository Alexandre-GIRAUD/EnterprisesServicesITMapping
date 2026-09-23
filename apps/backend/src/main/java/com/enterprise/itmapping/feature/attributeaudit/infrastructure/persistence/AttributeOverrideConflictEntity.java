package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.OverrideConflictStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "attribute_override_conflicts")
public class AttributeOverrideConflictEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Enumerated(EnumType.STRING)
  @Column(name = "target_type", nullable = false, length = 32)
  private AuditTargetType targetType;

  @Column(name = "target_id", nullable = false, length = 128)
  private String targetId;

  @Enumerated(EnumType.STRING)
  @Column(name = "field_scope", nullable = false, length = 32)
  private AuditFieldScope fieldScope;

  @Column(name = "field_key", nullable = false, length = 128)
  private String fieldKey;

  @Column(name = "protected_value")
  private String protectedValue;

  @Column(name = "proposed_value")
  private String proposedValue;

  @Column(name = "ai_source", length = 64)
  private String aiSource;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private OverrideConflictStatus status;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "resolved_at")
  private Instant resolvedAt;

  @Column(name = "resolved_by_user_id")
  private UUID resolvedByUserId;

  @PrePersist
  void prePersist() {
    if (id == null) {
      id = UUID.randomUUID();
    }
    if (createdAt == null) {
      createdAt = Instant.now();
    }
    if (status == null) {
      status = OverrideConflictStatus.PENDING;
    }
  }

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public AuditTargetType getTargetType() {
    return targetType;
  }

  public void setTargetType(AuditTargetType targetType) {
    this.targetType = targetType;
  }

  public String getTargetId() {
    return targetId;
  }

  public void setTargetId(String targetId) {
    this.targetId = targetId;
  }

  public AuditFieldScope getFieldScope() {
    return fieldScope;
  }

  public void setFieldScope(AuditFieldScope fieldScope) {
    this.fieldScope = fieldScope;
  }

  public String getFieldKey() {
    return fieldKey;
  }

  public void setFieldKey(String fieldKey) {
    this.fieldKey = fieldKey;
  }

  public String getProtectedValue() {
    return protectedValue;
  }

  public void setProtectedValue(String protectedValue) {
    this.protectedValue = protectedValue;
  }

  public String getProposedValue() {
    return proposedValue;
  }

  public void setProposedValue(String proposedValue) {
    this.proposedValue = proposedValue;
  }

  public String getAiSource() {
    return aiSource;
  }

  public void setAiSource(String aiSource) {
    this.aiSource = aiSource;
  }

  public OverrideConflictStatus getStatus() {
    return status;
  }

  public void setStatus(OverrideConflictStatus status) {
    this.status = status;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getResolvedAt() {
    return resolvedAt;
  }

  public void setResolvedAt(Instant resolvedAt) {
    this.resolvedAt = resolvedAt;
  }

  public UUID getResolvedByUserId() {
    return resolvedByUserId;
  }

  public void setResolvedByUserId(UUID resolvedByUserId) {
    this.resolvedByUserId = resolvedByUserId;
  }
}
