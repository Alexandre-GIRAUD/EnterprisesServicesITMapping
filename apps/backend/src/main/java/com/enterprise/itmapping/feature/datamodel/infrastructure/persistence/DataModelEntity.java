package com.enterprise.itmapping.feature.datamodel.infrastructure.persistence;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceOwned;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "data_model")
public class DataModelEntity extends WorkspaceOwned {

  private static final int UUID_TEXT_LENGTH = 36;

  /** The owning workspace id as text: one Data Model per workspace. */
  @Id
  @Column(nullable = false, updatable = false, length = UUID_TEXT_LENGTH)
  private String id;

  protected DataModelEntity() {}

  public DataModelEntity(String id) {
    this.id = id;
  }

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<DataModelField> fields = new ArrayList<>();

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "updated_by")
  private UserEntity updatedBy;

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }

  public String getId() {
    return id;
  }

  public List<DataModelField> getFields() {
    return fields;
  }

  public void setFields(List<DataModelField> fields) {
    this.fields = fields != null ? fields : new ArrayList<>();
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
