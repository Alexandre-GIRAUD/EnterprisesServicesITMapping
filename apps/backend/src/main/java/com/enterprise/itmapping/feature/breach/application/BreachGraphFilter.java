package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Narrows a map graph to the applications and flows in breach. */
final class BreachGraphFilter {

  private BreachGraphFilter() {}

  /**
   * Keeps the applications in breach with the flows between them, and the flows in breach with
   * both endpoints. A flow whose endpoint is not in {@code graph} is dropped.
   */
  static GraphResponseDto narrow(
      GraphResponseDto graph, Set<String> applicationIds, Set<String> flowIds) {
    Set<String> presentNodeIds =
        graph.nodes().stream().map(GraphNodeDto::id).collect(Collectors.toSet());
    List<GraphEdgeDto> keptEdges =
        graph.edges().stream()
            .filter(edge -> presentNodeIds.contains(edge.sourceId()))
            .filter(edge -> presentNodeIds.contains(edge.targetId()))
            .filter(
                edge ->
                    flowIds.contains(edge.id())
                        || (applicationIds.contains(edge.sourceId())
                            && applicationIds.contains(edge.targetId())))
            .toList();
    Set<String> keptNodeIds = new HashSet<>(applicationIds);
    for (GraphEdgeDto edge : keptEdges) {
      keptNodeIds.add(edge.sourceId());
      keptNodeIds.add(edge.targetId());
    }
    List<GraphNodeDto> keptNodes =
        graph.nodes().stream().filter(node -> keptNodeIds.contains(node.id())).toList();
    return new GraphResponseDto(keptNodes, keptEdges);
  }
}
