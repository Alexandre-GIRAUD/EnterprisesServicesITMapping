package com.enterprise.itmapping.feature.workspace.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.util.UUID;
import org.hibernate.annotations.TenantId;

/**
 * A row that belongs to one workspace. Hibernate fills the column from the current workspace on
 * insert and restricts every JPA read to it, so repositories need no workspace parameter.
 */
@MappedSuperclass
public abstract class WorkspaceOwned {

  @TenantId
  @Column(name = "workspace_id", nullable = false, updatable = false)
  private UUID workspaceId;
}
