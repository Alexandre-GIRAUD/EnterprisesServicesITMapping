package com.enterprise.itmapping.feature.breach.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class BreachGraphFilterTest {

  private static final GraphResponseDto GRAPH =
      new GraphResponseDto(
          List.of(node("a"), node("b"), node("c"), node("d")),
          List.of(edge("ab", "a", "b"), edge("bc", "b", "c"), edge("cd", "c", "d")));

  private static GraphNodeDto node(String id) {
    return new GraphNodeDto(id, id, "Application", null, Map.of());
  }

  private static GraphEdgeDto edge(String id, String source, String target) {
    return new GraphEdgeDto(id, source, target, "DEPENDS_ON", null, Map.of());
  }

  private static List<String> nodeIds(GraphResponseDto graph) {
    return graph.nodes().stream().map(GraphNodeDto::id).toList();
  }

  private static List<String> edgeIds(GraphResponseDto graph) {
    return graph.edges().stream().map(GraphEdgeDto::id).toList();
  }

  @Test
  void applicationBreachesKeepTheApplicationsAndTheFlowsBetweenThem() {
    GraphResponseDto narrowed = BreachGraphFilter.narrow(GRAPH, Set.of("a", "b", "d"), Set.of());

    assertThat(nodeIds(narrowed)).containsExactly("a", "b", "d");
    assertThat(edgeIds(narrowed)).containsExactly("ab");
  }

  @Test
  void flowBreachesKeepTheFlowsAndBothEndpoints() {
    GraphResponseDto narrowed = BreachGraphFilter.narrow(GRAPH, Set.of(), Set.of("cd"));

    assertThat(nodeIds(narrowed)).containsExactly("c", "d");
    assertThat(edgeIds(narrowed)).containsExactly("cd");
  }

  @Test
  void bothKindsAreUnitedWithoutLinkingAnEndpointToABreachedApplication() {
    GraphResponseDto narrowed = BreachGraphFilter.narrow(GRAPH, Set.of("a"), Set.of("bc"));

    assertThat(nodeIds(narrowed)).containsExactly("a", "b", "c");
    assertThat(edgeIds(narrowed)).containsExactly("bc");
  }

  @Test
  void aFlowWhoseEndpointWasFilteredOutIsDropped() {
    GraphResponseDto filtered =
        new GraphResponseDto(List.of(node("c")), List.of(edge("cd", "c", "d")));

    GraphResponseDto narrowed = BreachGraphFilter.narrow(filtered, Set.of(), Set.of("cd"));

    assertThat(nodeIds(narrowed)).isEmpty();
    assertThat(edgeIds(narrowed)).isEmpty();
  }
}
