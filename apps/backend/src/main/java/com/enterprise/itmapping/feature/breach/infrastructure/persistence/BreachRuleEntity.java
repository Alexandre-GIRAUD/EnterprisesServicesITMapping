package com.enterprise.itmapping.feature.breach.infrastructure.persistence;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachRule;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceOwned;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "breach_rules")
public class BreachRuleEntity extends WorkspaceOwned {

  /** Matches {@code breach_rules.subject VARCHAR(16)}. */
  private static final int SUBJECT_LENGTH = 16;

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Column(nullable = false, length = BreachRule.MAX_NAME_LENGTH)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = SUBJECT_LENGTH)
  private BreachSubject subject;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private BreachDefinition definition;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "updated_by")
  private UserEntity updatedBy;

  protected BreachRuleEntity() {}

  public BreachRuleEntity(UUID id) {
    this.id = id;
  }

  @PrePersist
  @PreUpdate
  void touch() {
    updatedAt = Instant.now();
  }

  public BreachRule toDomain() {
    return new BreachRule(id, name, subject, definition);
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public BreachSubject getSubject() {
    return subject;
  }

  public void setSubject(BreachSubject subject) {
    this.subject = subject;
  }

  public BreachDefinition getDefinition() {
    return definition;
  }

  public void setDefinition(BreachDefinition definition) {
    this.definition = definition;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public UserEntity getUpdatedBy() {
    return updatedBy;
  }

  public void setUpdatedBy(UserEntity updatedBy) {
    this.updatedBy = updatedBy;
  }
}
