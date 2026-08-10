package com.enterprise.itmapping.feature.changedetection.infrastructure.persistence;

import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemKind;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemStatus;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "change_detection_items")
public class ChangeDetectionItemEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "run_id", nullable = false, updatable = false)
  private ChangeDetectionRunEntity run;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private ChangeDetectionItemKind kind;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private ChangeDetectionItemStatus status = ChangeDetectionItemStatus.PENDING;

  @Column(nullable = false)
  private double confidence = 0.5;

  @Column(nullable = false, columnDefinition = "text")
  private String summary;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<Map<String, Object>> evidence = new ArrayList<>();

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private Map<String, Object> payload = new LinkedHashMap<>();

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) {
      id = UUID.randomUUID();
    }
    Instant now = Instant.now();
    if (createdAt == null) {
      createdAt = now;
    }
    if (updatedAt == null) {
      updatedAt = now;
    }
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public ChangeDetectionRunEntity getRun() {
    return run;
  }

  public void setRun(ChangeDetectionRunEntity run) {
    this.run = run;
  }

  public ChangeDetectionItemKind getKind() {
    return kind;
  }

  public void setKind(ChangeDetectionItemKind kind) {
    this.kind = kind;
  }

  public ChangeDetectionItemStatus getStatus() {
    return status;
  }

  public void setStatus(ChangeDetectionItemStatus status) {
    this.status = status;
  }

  public double getConfidence() {
    return confidence;
  }

  public void setConfidence(double confidence) {
    this.confidence = confidence;
  }

  public String getSummary() {
    return summary;
  }

  public void setSummary(String summary) {
    this.summary = summary;
  }

  public List<Map<String, Object>> getEvidence() {
    return evidence;
  }

  public void setEvidence(List<Map<String, Object>> evidence) {
    this.evidence = evidence != null ? evidence : new ArrayList<>();
  }

  public Map<String, Object> getPayload() {
    return payload;
  }

  public void setPayload(Map<String, Object> payload) {
    this.payload = payload != null ? payload : new LinkedHashMap<>();
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
