package com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
@Table(name = "graph_snapshots")
public class GraphSnapshotEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false, updatable = false)
  private UserEntity user;

  @Column(nullable = false, length = 80)
  private String name;

  @Column(name = "year")
  private Integer year;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "application_ids", nullable = false, columnDefinition = "jsonb")
  private List<String> applicationIds = new ArrayList<>();

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "business_unit_ids", nullable = false, columnDefinition = "jsonb")
  private List<String> businessUnitIds = new ArrayList<>();

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "region_codes", nullable = false, columnDefinition = "jsonb")
  private List<String> regionCodes = new ArrayList<>();

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

  public UserEntity getUser() {
    return user;
  }

  public void setUser(UserEntity user) {
    this.user = user;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public Integer getYear() {
    return year;
  }

  public void setYear(Integer year) {
    this.year = year;
  }

  public List<String> getApplicationIds() {
    return applicationIds;
  }

  public void setApplicationIds(List<String> applicationIds) {
    this.applicationIds = applicationIds != null ? applicationIds : new ArrayList<>();
  }

  public List<String> getBusinessUnitIds() {
    return businessUnitIds;
  }

  public void setBusinessUnitIds(List<String> businessUnitIds) {
    this.businessUnitIds = businessUnitIds != null ? businessUnitIds : new ArrayList<>();
  }

  public List<String> getRegionCodes() {
    return regionCodes;
  }

  public void setRegionCodes(List<String> regionCodes) {
    this.regionCodes = regionCodes != null ? regionCodes : new ArrayList<>();
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
