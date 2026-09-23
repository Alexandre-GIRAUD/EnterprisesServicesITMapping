package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "human_field_overrides")
@IdClass(HumanFieldOverrideEntity.Pk.class)
public class HumanFieldOverrideEntity {

  @Id
  @Enumerated(EnumType.STRING)
  @Column(name = "target_type", nullable = false, length = 32)
  private AuditTargetType targetType;

  @Id
  @Column(name = "target_id", nullable = false, length = 128)
  private String targetId;

  @Id
  @Column(name = "field_key", nullable = false, length = 128)
  private String fieldKey;

  @Column(name = "last_human_event_id", nullable = false)
  private UUID lastHumanEventId;

  @Column(name = "protected_value")
  private String protectedValue;

  @Enumerated(EnumType.STRING)
  @Column(name = "human_reason", length = 32)
  private HumanChangeReason humanReason;

  @Column(name = "human_reason_comment")
  private String humanReasonComment;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  @PreUpdate
  void touch() {
    updatedAt = Instant.now();
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

  public String getFieldKey() {
    return fieldKey;
  }

  public void setFieldKey(String fieldKey) {
    this.fieldKey = fieldKey;
  }

  public UUID getLastHumanEventId() {
    return lastHumanEventId;
  }

  public void setLastHumanEventId(UUID lastHumanEventId) {
    this.lastHumanEventId = lastHumanEventId;
  }

  public String getProtectedValue() {
    return protectedValue;
  }

  public void setProtectedValue(String protectedValue) {
    this.protectedValue = protectedValue;
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

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public static class Pk implements Serializable {
    private AuditTargetType targetType;
    private String targetId;
    private String fieldKey;

    public Pk() {}

    public Pk(AuditTargetType targetType, String targetId, String fieldKey) {
      this.targetType = targetType;
      this.targetId = targetId;
      this.fieldKey = fieldKey;
    }

    @Override
    public boolean equals(Object o) {
      if (this == o) return true;
      if (!(o instanceof Pk pk)) return false;
      return targetType == pk.targetType
          && Objects.equals(targetId, pk.targetId)
          && Objects.equals(fieldKey, pk.fieldKey);
    }

    @Override
    public int hashCode() {
      return Objects.hash(targetType, targetId, fieldKey);
    }
  }
}
