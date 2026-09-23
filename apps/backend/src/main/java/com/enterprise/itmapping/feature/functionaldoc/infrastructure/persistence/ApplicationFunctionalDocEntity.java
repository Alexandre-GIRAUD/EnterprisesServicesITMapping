package com.enterprise.itmapping.feature.functionaldoc.infrastructure.persistence;

import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload;
import com.enterprise.itmapping.feature.functionaldoc.domain.FunctionalDocStatus;
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
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "application_functional_docs")
public class ApplicationFunctionalDocEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Column(name = "application_id", nullable = false, unique = true, length = 128)
  private String applicationId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private FunctionalDocStatus status = FunctionalDocStatus.PENDING;

  @Column(nullable = false, length = 16)
  private String locale = "en";

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private AiFunctionalDocPayload payload;

  @Column(name = "markdown_cache", columnDefinition = "TEXT")
  private String markdownCache;

  @Column(name = "source_repo", length = 255)
  private String sourceRepo;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "analyzed_files", nullable = false, columnDefinition = "jsonb")
  private List<String> analyzedFiles = new ArrayList<>();

  @Column(name = "error_message")
  private String errorMessage;

  @Column(name = "generated_at")
  private Instant generatedAt;

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
    if (analyzedFiles == null) {
      analyzedFiles = new ArrayList<>();
    }
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public String getApplicationId() {
    return applicationId;
  }

  public void setApplicationId(String applicationId) {
    this.applicationId = applicationId;
  }

  public FunctionalDocStatus getStatus() {
    return status;
  }

  public void setStatus(FunctionalDocStatus status) {
    this.status = status;
  }

  public String getLocale() {
    return locale;
  }

  public void setLocale(String locale) {
    this.locale = locale;
  }

  public AiFunctionalDocPayload getPayload() {
    return payload;
  }

  public void setPayload(AiFunctionalDocPayload payload) {
    this.payload = payload;
  }

  public String getMarkdownCache() {
    return markdownCache;
  }

  public void setMarkdownCache(String markdownCache) {
    this.markdownCache = markdownCache;
  }

  public String getSourceRepo() {
    return sourceRepo;
  }

  public void setSourceRepo(String sourceRepo) {
    this.sourceRepo = sourceRepo;
  }

  public List<String> getAnalyzedFiles() {
    return analyzedFiles != null ? analyzedFiles : List.of();
  }

  public void setAnalyzedFiles(List<String> analyzedFiles) {
    this.analyzedFiles = analyzedFiles != null ? new ArrayList<>(analyzedFiles) : new ArrayList<>();
  }

  public String getErrorMessage() {
    return errorMessage;
  }

  public void setErrorMessage(String errorMessage) {
    this.errorMessage = errorMessage;
  }

  public Instant getGeneratedAt() {
    return generatedAt;
  }

  public void setGeneratedAt(Instant generatedAt) {
    this.generatedAt = generatedAt;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
