package com.enterprise.itmapping.feature.workspace.application;

import java.util.Optional;
import java.util.UUID;

/**
 * The workspace the current thread works in. A request binds the signed-in user's workspace;
 * background work binds it explicitly with {@link #runAs}. Nothing bound means no workspace data.
 */
public final class CurrentWorkspace {

  private static final ThreadLocal<UUID> BOUND = new ThreadLocal<>();

  private CurrentWorkspace() {}

  public static Optional<UUID> find() {
    return Optional.ofNullable(BOUND.get());
  }

  public static UUID requireId() {
    return find().orElseThrow(() -> new IllegalStateException("No workspace bound to this thread."));
  }

  /** Binds {@code workspaceId} until the returned binding is closed, then restores the previous one. */
  public static Binding bind(UUID workspaceId) {
    UUID previous = BOUND.get();
    BOUND.set(workspaceId);
    return () -> restore(previous);
  }

  public static void runAs(UUID workspaceId, Runnable action) {
    try (Binding ignored = bind(workspaceId)) {
      action.run();
    }
  }

  /** Wraps {@code task} so it runs in the workspace bound when this method is called. */
  public static Runnable decorate(Runnable task) {
    UUID captured = BOUND.get();
    if (captured == null) {
      return task;
    }
    return () -> runAs(captured, task);
  }

  private static void restore(UUID previous) {
    if (previous == null) {
      BOUND.remove();
    } else {
      BOUND.set(previous);
    }
  }

  /** A scope in which a workspace is bound. */
  @FunctionalInterface
  public interface Binding extends AutoCloseable {
    @Override
    void close();
  }
}
