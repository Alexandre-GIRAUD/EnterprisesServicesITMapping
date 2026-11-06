package com.enterprise.itmapping.feature.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class CurrentWorkspaceTest {

  @Test
  void requireIdFailsWhenNoWorkspaceIsBound() {
    assertThatThrownBy(CurrentWorkspace::requireId).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void runAsBindsTheWorkspaceAndRestoresThePreviousOne() {
    UUID outer = UUID.randomUUID();
    UUID inner = UUID.randomUUID();
    AtomicReference<UUID> seenInside = new AtomicReference<>();

    CurrentWorkspace.runAs(
        outer,
        () -> {
          CurrentWorkspace.runAs(inner, () -> seenInside.set(CurrentWorkspace.requireId()));
          assertThat(CurrentWorkspace.requireId()).isEqualTo(outer);
        });

    assertThat(seenInside.get()).isEqualTo(inner);
    assertThat(CurrentWorkspace.find()).isEqualTo(Optional.empty());
  }

  @Test
  void decorateCarriesTheCallerWorkspaceToAnotherThread() throws Exception {
    UUID workspaceId = UUID.randomUUID();
    AtomicReference<UUID> seenOnWorker = new AtomicReference<>();
    AtomicReference<Runnable> decorated = new AtomicReference<>();

    CurrentWorkspace.runAs(
        workspaceId,
        () ->
            decorated.set(
                CurrentWorkspace.decorate(
                    () -> seenOnWorker.set(CurrentWorkspace.requireId()))));
    Thread worker = new Thread(decorated.get());
    worker.start();
    worker.join();

    assertThat(seenOnWorker.get()).isEqualTo(workspaceId);
  }
}
