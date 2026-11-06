package com.enterprise.itmapping.feature.workspace.infrastructure;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.neo4j.core.Neo4jClient;

class WorkspaceGraphTest {

  private final WorkspaceGraph graph = new WorkspaceGraph(mock(Neo4jClient.class));

  @Test
  void refusesCypherThatDoesNotFilterOnTheWorkspace() {
    CurrentWorkspace.runAs(
        UUID.randomUUID(),
        () ->
            assertThatThrownBy(() -> graph.query("MATCH (a:Application) RETURN a"))
                .isInstanceOf(IllegalArgumentException.class));
  }

  @Test
  void refusesToRunWithoutAWorkspace() {
    assertThatThrownBy(
            () -> graph.query("MATCH (a:Application {workspaceId: $workspaceId}) RETURN a"))
        .isInstanceOf(IllegalStateException.class);
  }
}
