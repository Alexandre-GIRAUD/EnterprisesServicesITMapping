package com.enterprise.itmapping.feature.sources.infrastructure.persistence;

import com.enterprise.itmapping.feature.sources.domain.SourceAuthType;
import com.enterprise.itmapping.feature.sources.domain.SourceKind;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceOwned;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "data_sources")
public class DataSourceEntity extends WorkspaceOwned {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Column(nullable = false, length = 120)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private SourceKind kind;

  @Column(nullable = false, length = 1000)
  private String endpoint;

  @Column(name = "tool_name", length = 200)
  private String toolName;

  @Column(name = "items_path", length = 200)
  private String itemsPath;

  @Enumerated(EnumType.STRING)
  @Column(name = "auth_type", nullable = false, length = 16)
  private SourceAuthType authType = SourceAuthType.NONE;

  @Column(name = "auth_header_name", length = 120)
  private String authHeaderName;

  @Column(name = "auth_username", length = 200)
  private String authUsername;

  @Column(name = "secret_encrypted")
  private String secretEncrypted;

  @Column(name = "key_column", length = 200)
  private String keyColumn;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "column_map", nullable = false, columnDefinition = "jsonb")
  private Map<String, String> columnMap = new LinkedHashMap<>();

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) {
      id = UUID.randomUUID();
    }
    createdAt = Instant.now();
    updatedAt = createdAt;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
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

  public SourceKind getKind() {
    return kind;
  }

  public void setKind(SourceKind kind) {
    this.kind = kind;
  }

  public String getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(String endpoint) {
    this.endpoint = endpoint;
  }

  public String getToolName() {
    return toolName;
  }

  public void setToolName(String toolName) {
    this.toolName = toolName;
  }

  public String getItemsPath() {
    return itemsPath;
  }

  public void setItemsPath(String itemsPath) {
    this.itemsPath = itemsPath;
  }

  public SourceAuthType getAuthType() {
    return authType;
  }

  public void setAuthType(SourceAuthType authType) {
    this.authType = authType;
  }

  public String getAuthHeaderName() {
    return authHeaderName;
  }

  public void setAuthHeaderName(String authHeaderName) {
    this.authHeaderName = authHeaderName;
  }

  public String getAuthUsername() {
    return authUsername;
  }

  public void setAuthUsername(String authUsername) {
    this.authUsername = authUsername;
  }

  public String getSecretEncrypted() {
    return secretEncrypted;
  }

  public void setSecretEncrypted(String secretEncrypted) {
    this.secretEncrypted = secretEncrypted;
  }

  public String getKeyColumn() {
    return keyColumn;
  }

  public void setKeyColumn(String keyColumn) {
    this.keyColumn = keyColumn;
  }

  public Map<String, String> getColumnMap() {
    return columnMap != null ? Map.copyOf(columnMap) : Map.of();
  }

  public void setColumnMap(Map<String, String> columnMap) {
    this.columnMap = columnMap != null ? new LinkedHashMap<>(columnMap) : new LinkedHashMap<>();
  }
}
