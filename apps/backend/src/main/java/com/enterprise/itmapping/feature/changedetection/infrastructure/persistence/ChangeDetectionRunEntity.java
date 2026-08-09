package com.enterprise.itmapping.feature.changedetection.infrastructure.persistence;

import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionRunStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
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
@Table(name = "change_detection_runs")
public class ChangeDetectionRunEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Column(nullable = false, length = 32)
  private String provider = "GITHUB";

  @Column(name = "repo_full_name", nullable = false, length = 255)
  private String repoFullName;

  @Column(name = "commit_sha", nullable = false, length = 64)
  private String commitSha;

  @Column(name = "branch_ref", nullable = false, length = 255)
  private String branchRef;

  @Column(name = "application_id", length = 128)
  private String applicationId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private ChangeDetectionRunStatus status = ChangeDetectionRunStatus.RECEIVED;

  @Column(nullable = false)
  private boolean truncated;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<String> buckets = new ArrayList<>();

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<Map<String, Object>> files = new ArrayList<>();

  @Column(name = "error_message")
  private String errorMessage;

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

  public String getProvider() {
    return provider;
  }

  public void setProvider(String provider) {
    this.provider = provider;
  }

  public String getRepoFullName() {
    return repoFullName;
  }

  public void setRepoFullName(String repoFullName) {
    this.repoFullName = repoFullName;
  }

  public String getCommitSha() {
    return commitSha;
  }

  public void setCommitSha(String commitSha) {
    this.commitSha = commitSha;
  }

  public String getBranchRef() {
    return branchRef;
  }

  public void setBranchRef(String branchRef) {
    this.branchRef = branchRef;
  }

  public String getApplicationId() {
    return applicationId;
  }

  public void setApplicationId(String applicationId) {
    this.applicationId = applicationId;
  }

  public ChangeDetectionRunStatus getStatus() {
    return status;
  }

  public void setStatus(ChangeDetectionRunStatus status) {
    this.status = status;
  }

  public boolean isTruncated() {
    return truncated;
  }

  public void setTruncated(boolean truncated) {
    this.truncated = truncated;
  }

  public List<String> getBuckets() {
    return buckets;
  }

  public void setBuckets(List<String> buckets) {
    this.buckets = buckets != null ? buckets : new ArrayList<>();
  }

  public List<Map<String, Object>> getFiles() {
    return files;
  }

  public void setFiles(List<Map<String, Object>> files) {
    this.files = files != null ? files : new ArrayList<>();
  }

  public String getErrorMessage() {
    return errorMessage;
  }

  public void setErrorMessage(String errorMessage) {
    this.errorMessage = errorMessage;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public static Map<String, Object> fileRow(String path, String status, String bucket) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("path", path);
    row.put("status", status);
    row.put("bucket", bucket);
    return row;
  }
}
