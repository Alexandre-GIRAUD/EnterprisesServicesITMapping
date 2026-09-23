package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditActorType;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
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
@Table(name = "attribute_change_events")
public class AttributeChangeEventEntity {

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

  @Column(name = "old_value")
  private String oldValue;

  @Column(name = "new_value")
  private String newValue;

  @Enumerated(EnumType.STRING)
  @Column(name = "actor_type", nullable = false, length = 16)
  private AuditActorType actorType;

  @Column(name = "actor_user_id")
  private UUID actorUserId;

  @Column(name = "actor_username", length = 64)
  private String actorUsername;

  @Column(name = "ai_source", length = 64)
  private String aiSource;

  @Enumerated(EnumType.STRING)
  @Column(name = "human_reason", length = 32)
  private HumanChangeReason humanReason;

  @Column(name = "human_reason_comment")
  private String humanReasonComment;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @PrePersist
  void prePersist() {
    if (id == null) {
      id = UUID.randomUUID();
    }
    if (createdAt == null) {
      createdAt = Instant.now();
    }
  }

  public UUID getId() {
    return id;
  }

  /** Visible for tests and persistence adapters that assign ids explicitly. */
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

  public String getOldValue() {
    return oldValue;
  }

  public void setOldValue(String oldValue) {
    this.oldValue = oldValue;
  }

  public String getNewValue() {
    return newValue;
  }

  public void setNewValue(String newValue) {
    this.newValue = newValue;
  }

  public AuditActorType getActorType() {
    return actorType;
  }

  public void setActorType(AuditActorType actorType) {
    this.actorType = actorType;
  }

  public UUID getActorUserId() {
    return actorUserId;
  }

  public void setActorUserId(UUID actorUserId) {
    this.actorUserId = actorUserId;
  }

  public String getActorUsername() {
    return actorUsername;
  }

  public void setActorUsername(String actorUsername) {
    this.actorUsername = actorUsername;
  }

  public String getAiSource() {
    return aiSource;
  }

  public void setAiSource(String aiSource) {
    this.aiSource = aiSource;
  }

  public HumanChangeReason getHumanReason() {
    return humanReason;
  }

  public void setHumanReason(HumanChangeReason humanReason) {
    this.humanReason = humanReason;
  }

  public String getHumanReasonComment() {
    return humanReasonComment;
  }

  public void setHumanReasonComment(String humanReasonComment) {
    this.humanReasonComment = humanReasonComment;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
