package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ModuleGraphLoader;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeProjection;
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
    when(moduleGraphLoader.applicationExists(eq("app-1"))).thenReturn(true);
    when(moduleGraphLoader.loadNodes(eq("app-1")))
        .thenReturn(
            List.of(
                new ModuleGraphNodeRow("app-1", "Portail", "Interface web B2B", "Application"),
                new ModuleGraphNodeRow("mod-1", "UI SPA", "Interface utilisateur", "Module")));
    when(moduleGraphLoader.loadEdges(eq("app-1")))
        .thenReturn(List.of(new GraphEdgeProjection("app-1", "mod-1", "CONTAINS")));

    var graph = moduleGraphService.getModuleGraph("app-1").orElseThrow();

    assertThat(graph.nodes()).hasSize(2);
    var app =
        graph.nodes().stream().filter(n -> "Application".equals(n.type())).findFirst().orElseThrow();
    assertThat(app.description()).isEqualTo("Interface web B2B");

    var mod = graph.nodes().stream().filter(n -> "Module".equals(n.type())).findFirst().orElseThrow();
    assertThat(mod.description()).isEqualTo("Interface utilisateur");
  }

  @Test
  void getModuleGraphOmitsBlankDescription() {
    when(moduleGraphLoader.applicationExists(any())).thenReturn(true);
    when(moduleGraphLoader.loadNodes(any()))
        .thenReturn(
            List.of(
                new ModuleGraphNodeRow("m1", "M", "  ", "Module")));
    when(moduleGraphLoader.loadEdges(any())).thenReturn(List.of());

    var mod =
        moduleGraphService.getModuleGraph("app-1").orElseThrow().nodes().getFirst();
    assertThat(mod.description()).isNull();
  }

  @Test
  void getModuleGraphForwardsModuleAndApplicationDetailsAsProperties() {
    when(moduleGraphLoader.applicationExists(any())).thenReturn(true);
    when(moduleGraphLoader.loadNodes(any()))
        .thenReturn(
            List.of(
                new ModuleGraphNodeRow(
                    "app-1",
                    "Booking",
                    null,
                    "Application",
                    Map.of(
                        "businessObjects", List.of("Trade"),
                        "mainJourney", "Capture then value",
                        "scope", " ")),
                new ModuleGraphNodeRow(
                    "m1",
                    "Ingest",
                    null,
                    "Module",
                    Map.of(
                        "owner", "Front office",
                        "actors", List.of("Traders"),
                        "trigger", "On each deal",
                        "dataIn", List.of("Order"),
                        "dataOut", List.of("Trade"))),
                new ModuleGraphNodeRow("m2", "Bare", null, "Module")));
    when(moduleGraphLoader.loadEdges(any())).thenReturn(List.of());

    var nodes = moduleGraphService.getModuleGraph("app-1").orElseThrow().nodes();

    assertThat(nodes.get(0).properties())
        .containsEntry("businessObjects", List.of("Trade"))
        .containsEntry("mainJourney", "Capture then value")
        .doesNotContainKey("scope");
    assertThat(nodes.get(1).properties())
        .containsEntry("owner", "Front office")
        .containsEntry("actors", List.of("Traders"))
        .containsEntry("trigger", "On each deal")
        .containsEntry("dataIn", List.of("Order"))
        .containsEntry("dataOut", List.of("Trade"));
    assertThat(nodes.get(2).properties()).isEmpty();
  }

  @Test
  void getModuleGraphKeepsFeedsLinksWithTheirBusinessObject() {
    when(moduleGraphLoader.applicationExists(any())).thenReturn(true);
    when(moduleGraphLoader.loadNodes(any())).thenReturn(List.of());
    when(moduleGraphLoader.loadEdges(any()))
        .thenReturn(
            List.of(
                new GraphEdgeProjection("app-1", "a", "CONTAINS"),
                new GraphEdgeProjection("a", "b", "FEEDS", "Trade", null, Map.of())));

    var edges = moduleGraphService.getModuleGraph("app-1").orElseThrow().edges();

    assertThat(edges).extracting(e -> e.type()).containsExactly("CONTAINS", "FEEDS");
    assertThat(edges.get(1).data()).isEqualTo("Trade");
  }
}
