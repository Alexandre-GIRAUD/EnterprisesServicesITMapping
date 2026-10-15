package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "entity_validations")
@IdClass(EntityValidationEntity.Pk.class)
public class EntityValidationEntity {

  @Id
  @Enumerated(EnumType.STRING)
  @Column(name = "target_type", nullable = false, length = 32)
  private AuditTargetType targetType;

  @Id
  @Column(name = "target_id", nullable = false, length = 128)
  private String targetId;

  @Column(name = "validated_by_user_id", nullable = false)
  private UUID validatedByUserId;

  @Column(name = "validated_by_username", nullable = false, length = 64)
  private String validatedByUsername;

  @Column(name = "validated_at", nullable = false)
  private Instant validatedAt;

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

  public UUID getValidatedByUserId() {
    return validatedByUserId;
  }

  public void setValidatedByUserId(UUID validatedByUserId) {
    this.validatedByUserId = validatedByUserId;
  }

  public String getValidatedByUsername() {
    return validatedByUsername;
  }

  public void setValidatedByUsername(String validatedByUsername) {
    this.validatedByUsername = validatedByUsername;
  }

  public Instant getValidatedAt() {
    return validatedAt;
  }

  public void setValidatedAt(Instant validatedAt) {
    this.validatedAt = validatedAt;
  }

  public static class Pk implements Serializable {
    private AuditTargetType targetType;
    private String targetId;

    public Pk() {}

    public Pk(AuditTargetType targetType, String targetId) {
      this.targetType = targetType;
      this.targetId = targetId;
    }

    public AuditTargetType getTargetType() {
      return targetType;
    }

    public String getTargetId() {
      return targetId;
    }

    @Override
    public boolean equals(Object other) {
      if (this == other) {
        return true;
      }
      if (!(other instanceof Pk pk)) {
        return false;
      }
      return targetType == pk.targetType && Objects.equals(targetId, pk.targetId);
    }

    @Override
    public int hashCode() {
      return Objects.hash(targetType, targetId);
    }
  }
}
