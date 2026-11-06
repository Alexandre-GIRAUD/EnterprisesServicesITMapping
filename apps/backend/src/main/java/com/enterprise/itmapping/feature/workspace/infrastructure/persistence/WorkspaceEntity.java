package com.enterprise.itmapping.feature.workspace.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "workspaces")
public class WorkspaceEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  protected WorkspaceEntity() {}

  public UUID getId() {
    return id;
  }
}
