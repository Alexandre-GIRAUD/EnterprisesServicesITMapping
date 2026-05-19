package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ModuleGraphLoader;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeProjection;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ModuleGraphServiceTest {

  @Mock ModuleGraphLoader moduleGraphLoader;

  @InjectMocks ModuleGraphService moduleGraphService;

  @Test
  void getModuleGraphIncludesDescriptionOnApplicationAndModuleNodes() {
    Instant vf = Instant.parse("2025-01-01T00:00:00Z");
    when(moduleGraphLoader.applicationExistsValidAt(eq("app-1"), any())).thenReturn(true);
    when(moduleGraphLoader.loadNodes(eq("app-1"), any()))
        .thenReturn(
            List.of(
                new ModuleGraphNodeRow(
                    "app-1", "Portail", "Interface web B2B", vf, null, "Application"),
                new ModuleGraphNodeRow(
                    "mod-1", "UI SPA", "Interface utilisateur", vf, null, "Module")));
    when(moduleGraphLoader.loadEdges(eq("app-1"), any()))
        .thenReturn(List.of(new GraphEdgeProjection("app-1", "mod-1", "CONTAINS")));

    var graph = moduleGraphService.getModuleGraph("app-1", null).orElseThrow();

    assertThat(graph.nodes()).hasSize(2);
    var app =
        graph.nodes().stream().filter(n -> "Application".equals(n.type())).findFirst().orElseThrow();
    assertThat(app.description()).isEqualTo("Interface web B2B");

    var mod = graph.nodes().stream().filter(n -> "Module".equals(n.type())).findFirst().orElseThrow();
    assertThat(mod.description()).isEqualTo("Interface utilisateur");
  }

  @Test
  void getModuleGraphOmitsBlankDescription() {
    when(moduleGraphLoader.applicationExistsValidAt(any(), any())).thenReturn(true);
    when(moduleGraphLoader.loadNodes(any(), any()))
        .thenReturn(
            List.of(
                new ModuleGraphNodeRow("m1", "M", "  ", Instant.now(), null, "Module")));
    when(moduleGraphLoader.loadEdges(any(), any())).thenReturn(List.of());

    var mod =
        moduleGraphService.getModuleGraph("app-1", null).orElseThrow().nodes().getFirst();
    assertThat(mod.description()).isNull();
  }
}
