package com.enterprise.itmapping.feature.workspace.domain;

import java.util.UUID;

/** Well-known workspaces. */
public final class Workspaces {

  /** Holds every user and every piece of data that existed before workspaces (migration V31). */
  public static final UUID DEFAULT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private Workspaces() {}
}
