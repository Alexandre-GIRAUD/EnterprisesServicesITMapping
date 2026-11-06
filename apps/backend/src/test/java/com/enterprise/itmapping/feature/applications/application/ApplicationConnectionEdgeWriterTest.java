package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.enterprise.itmapping.feature.workspace.infrastructure.WorkspaceGraph;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ApplicationConnectionEdgeWriterTest {

  @Test
  void createUsesConnectionKindNotData() {
    WorkspaceGraph graph = mock(WorkspaceGraph.class, RETURNS_DEEP_STUBS);
    whenFetchEmpty(graph);
    ApplicationConnectionEdgeWriter writer = new ApplicationConnectionEdgeWriter(graph);

    writer.createOrMerge(
        "s1",
        "t1",
        "KAFKA",
        "orders.events",
        "outbound",
        "high",
        "app-1",
        Map.of("product_line", "ALPHA"),
        Set.of("product_line"));

    String createCypher = captureCypherContaining(graph, "CREATE (s)-[r:DEPENDS_ON");
    assertThat(createCypher).contains("direction: $dir");
    assertThat(createCypher).doesNotContain("connection_kind");
    assertThat(createCypher).doesNotContain("channel:");
    assertThat(createCypher).contains("SET r += $dynamicProps");
  }

  @Test
  void dedupQueryUsesConnectionKind() {
    WorkspaceGraph graph = mock(WorkspaceGraph.class, RETURNS_DEEP_STUBS);
    whenFetchEmpty(graph);
    ApplicationConnectionEdgeWriter writer = new ApplicationConnectionEdgeWriter(graph);

    writer.createOrMerge(
        "s1", "t1", "API", "", "outbound", "high", "app-1", Map.of(), Set.of());

    String dedupCypher = captureCypherContaining(graph, "properties(r) AS props");
    assertThat(dedupCypher).contains("DEPENDS_ON");
  }

  @Test
  void anEdgeWithTheSameDataModelValuesIsNotANewFlow() {
    WorkspaceGraph graph = mock(WorkspaceGraph.class, RETURNS_DEEP_STUBS);
    org.mockito.Mockito.when(graph.query(anyString()).bindAll(anyMap()).fetch().all())
        .thenReturn(
            List.of(
                Map.of(
                    "id",
                    "edge-1",
                    "props",
                    Map.of("data", "PV", "frequency", "real-time"))));
    ApplicationConnectionEdgeWriter writer = new ApplicationConnectionEdgeWriter(graph);

    assertThat(
            writer.isNewFlow(
                "datahub",
                "analytics",
                Map.of("data", "PV", "frequency", "real-time"),
                Set.of("data", "frequency")))
        .isFalse();
  }

  @Test
  void aDifferentDataModelValueIsANewFlow() {
    WorkspaceGraph graph = mock(WorkspaceGraph.class, RETURNS_DEEP_STUBS);
    org.mockito.Mockito.when(graph.query(anyString()).bindAll(anyMap()).fetch().all())
        .thenReturn(List.of(Map.of("id", "edge-1", "props", Map.of("data", "PV"))));
    org.mockito.Mockito.when(graph.query(anyString()).bindAll(anyMap()).fetch().first())
        .thenReturn(Optional.empty());
    ApplicationConnectionEdgeWriter writer = new ApplicationConnectionEdgeWriter(graph);

    assertThat(
            writer.isNewFlow(
                "datahub", "analytics", Map.of("data", "price"), Set.of("data", "frequency")))
        .isTrue();
  }

  private static void whenFetchEmpty(WorkspaceGraph graph) {
    org.mockito.Mockito.when(graph.query(anyString()).bindAll(anyMap()).fetch().first())
        .thenReturn(Optional.empty());
    org.mockito.Mockito.when(graph.query(anyString()).bindAll(anyMap()).fetch().all())
        .thenReturn(List.of());
  }

  private static String captureCypherContaining(WorkspaceGraph graph, String needle) {
    ArgumentCaptor<String> cypherCaptor = ArgumentCaptor.forClass(String.class);
    verify(graph, org.mockito.Mockito.atLeastOnce()).query(cypherCaptor.capture());
    return cypherCaptor.getAllValues().stream()
        .filter(c -> c.contains(needle))
        .findFirst()
        .orElseThrow();
  }
}
