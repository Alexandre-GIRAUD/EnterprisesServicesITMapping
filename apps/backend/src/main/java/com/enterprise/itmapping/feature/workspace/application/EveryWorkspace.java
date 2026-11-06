package com.enterprise.itmapping.feature.workspace.application;

import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceRepository;
import org.springframework.stereotype.Component;

/** Runs work nobody signed in for (schedules, webhooks) once inside each workspace. */
@Component
public class EveryWorkspace {

  private final WorkspaceRepository workspaces;

  public EveryWorkspace(WorkspaceRepository workspaces) {
    this.workspaces = workspaces;
  }

  public void run(Runnable action) {
    for (WorkspaceEntity workspace : workspaces.findAll()) {
      CurrentWorkspace.runAs(workspace.getId(), action);
    }
  }
}
