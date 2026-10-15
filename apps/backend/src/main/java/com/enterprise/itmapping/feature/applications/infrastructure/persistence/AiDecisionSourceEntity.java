package com.enterprise.itmapping.feature.applications.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "ai_decision_sources")
public class AiDecisionSourceEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Column(nullable = false, length = 64)
  private String pipeline;

  @Column(name = "decision_kind", nullable = false, length = 32)
  private String decisionKind;

  @Column(name = "target_type", nullable = false, length = 32)
  private String targetType;

  @Column(name = "target_id", nullable = false, length = 128)
  private String targetId;

  @Column(name = "field_key", length = 128)
  private String fieldKey;

  @Column(name = "repository", nullable = false, length = 255)
  private String repositoryName;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "source_files", nullable = false, columnDefinition = "jsonb")
  private List<String> sourceFiles = new ArrayList<>();

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
    if (sourceFiles == null) {
      sourceFiles = new ArrayList<>();
    }
  }

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public String getPipeline() {
    return pipeline;
  }

  public void setPipeline(String pipeline) {
    this.pipeline = pipeline;
  }

  public String getDecisionKind() {
    return decisionKind;
  }

  public void setDecisionKind(String decisionKind) {
    this.decisionKind = decisionKind;
  }

  public String getTargetType() {
    return targetType;
  }

  public void setTargetType(String targetType) {
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

  public String getRepositoryName() {
    return repositoryName;
  }

  public void setRepositoryName(String repositoryName) {
    this.repositoryName = repositoryName;
  }

  public List<String> getSourceFiles() {
    return sourceFiles != null ? List.copyOf(sourceFiles) : List.of();
  }

  public void setSourceFiles(List<String> sourceFiles) {
    this.sourceFiles = sourceFiles != null ? new ArrayList<>(sourceFiles) : new ArrayList<>();
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
