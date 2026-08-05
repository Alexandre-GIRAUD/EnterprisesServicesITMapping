package com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphSnapshotLegendDto;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.NodePositionDto;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "application_ids", nullable = false, columnDefinition = "jsonb")
  private List<String> applicationIds = new ArrayList<>();

  /** Data Model {@code target=NODE} key → selected values. */
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "node_attributes", nullable = false, columnDefinition = "jsonb")
  private Map<String, List<String>> nodeAttributes = new LinkedHashMap<>();

  /** Data Model {@code target=NODE_REF} key → selected catalogue ref ids. */
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "node_refs", nullable = false, columnDefinition = "jsonb")
  private Map<String, List<String>> nodeRefs = new LinkedHashMap<>();

  /** Data Model {@code target=EDGE} key → selected DEPENDS_ON property values. */
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "edge_attributes", nullable = false, columnDefinition = "jsonb")
  private Map<String, List<String>> edgeAttributes = new LinkedHashMap<>();

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "hidden_application_ids", nullable = false, columnDefinition = "jsonb")
  private List<String> hiddenApplicationIds = new ArrayList<>();

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "node_positions", nullable = false, columnDefinition = "jsonb")
  private Map<String, NodePositionDto> nodePositions = new LinkedHashMap<>();

  /** Optional legend coding snapshot (UI display only). */
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "legend", columnDefinition = "jsonb")
  private GraphSnapshotLegendDto legend;

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

  public List<String> getApplicationIds() {
    return applicationIds;
  }

  public void setApplicationIds(List<String> applicationIds) {
    this.applicationIds = applicationIds != null ? applicationIds : new ArrayList<>();
  }

  public Map<String, List<String>> getNodeAttributes() {
    return nodeAttributes;
  }

  public void setNodeAttributes(Map<String, List<String>> nodeAttributes) {
    this.nodeAttributes = nodeAttributes != null ? nodeAttributes : new LinkedHashMap<>();
  }

  public Map<String, List<String>> getNodeRefs() {
    return nodeRefs;
  }

  public void setNodeRefs(Map<String, List<String>> nodeRefs) {
    this.nodeRefs = nodeRefs != null ? nodeRefs : new LinkedHashMap<>();
  }

  public Map<String, List<String>> getEdgeAttributes() {
    return edgeAttributes;
  }

  public void setEdgeAttributes(Map<String, List<String>> edgeAttributes) {
    this.edgeAttributes = edgeAttributes != null ? edgeAttributes : new LinkedHashMap<>();
  }

  public List<String> getHiddenApplicationIds() {
    return hiddenApplicationIds;
  }

  public void setHiddenApplicationIds(List<String> hiddenApplicationIds) {
    this.hiddenApplicationIds =
        hiddenApplicationIds != null ? hiddenApplicationIds : new ArrayList<>();
  }

  public Map<String, NodePositionDto> getNodePositions() {
    return nodePositions;
  }

  public void setNodePositions(Map<String, NodePositionDto> nodePositions) {
    this.nodePositions = nodePositions != null ? nodePositions : new LinkedHashMap<>();
  }

  public GraphSnapshotLegendDto getLegend() {
    return legend;
  }

  public void setLegend(GraphSnapshotLegendDto legend) {
    this.legend = legend;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
