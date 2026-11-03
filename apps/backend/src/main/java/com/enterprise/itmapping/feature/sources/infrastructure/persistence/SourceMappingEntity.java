package com.enterprise.itmapping.feature.sources.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "data_source_mappings")
public class SourceMappingEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Column(name = "source_id", nullable = false)
  private UUID sourceId;

  @Column(name = "application_id", nullable = false, length = 128)
  private String applicationId;

  @Column(name = "source_key", length = 500)
  private String sourceKey;

  @Column(name = "no_match", nullable = false)
  private boolean noMatch;

  @PrePersist
  void prePersist() {
    if (id == null) {
      id = UUID.randomUUID();
    }
  }

  public UUID getSourceId() {
    return sourceId;
  }

  public void setSourceId(UUID sourceId) {
    this.sourceId = sourceId;
  }

  public String getApplicationId() {
    return applicationId;
  }

  public void setApplicationId(String applicationId) {
    this.applicationId = applicationId;
  }

  public String getSourceKey() {
    return sourceKey;
  }

  public void setSourceKey(String sourceKey) {
    this.sourceKey = sourceKey;
  }

  public boolean isNoMatch() {
    return noMatch;
  }

  public void setNoMatch(boolean noMatch) {
    this.noMatch = noMatch;
  }
}
