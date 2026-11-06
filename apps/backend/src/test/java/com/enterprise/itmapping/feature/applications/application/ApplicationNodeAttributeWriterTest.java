package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.enterprise.itmapping.feature.workspace.infrastructure.WorkspaceGraph;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ApplicationNodeAttributeWriterTest {

  @Test
  void writeSetsDynamicPropsOnApplication() {
    WorkspaceGraph graph = mock(WorkspaceGraph.class, RETURNS_DEEP_STUBS);
    ApplicationNodeAttributeWriter writer = new ApplicationNodeAttributeWriter(graph);

    int written =
        writer.write("app-1", Map.of("tier", "T1", "ignored", "x"), Set.of("tier"));

    assertThat(written).isEqualTo(1);
    ArgumentCaptor<String> cypherCaptor = ArgumentCaptor.forClass(String.class);
    verify(graph).query(cypherCaptor.capture());
    assertThat(cypherCaptor.getValue()).contains("MATCH (a:Application {workspaceId: $workspaceId, id: $id})");
    assertThat(cypherCaptor.getValue()).contains("SET a += $dynamicProps");
  }

  @Test
  void writeSkipsWhenNoWhitelistedProps() {
    WorkspaceGraph graph = mock(WorkspaceGraph.class, RETURNS_DEEP_STUBS);
    ApplicationNodeAttributeWriter writer = new ApplicationNodeAttributeWriter(graph);

    int written = writer.write("app-1", Map.of("name", "hack"), Set.of("tier"));

    assertThat(written).isZero();
    verify(graph, never()).query(anyString());
  }

  @Test
  void writeSkipsEmptyApplicationId() {
    WorkspaceGraph graph = mock(WorkspaceGraph.class, RETURNS_DEEP_STUBS);
    ApplicationNodeAttributeWriter writer = new ApplicationNodeAttributeWriter(graph);

    assertThat(writer.write("", Map.of("tier", "T1"), Set.of("tier"))).isZero();
    verify(graph, never()).query(anyString());
  }
}
