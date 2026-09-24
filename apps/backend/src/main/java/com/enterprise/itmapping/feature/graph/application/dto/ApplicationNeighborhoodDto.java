package com.enterprise.itmapping.feature.graph.application.dto;

import java.util.List;
import java.util.Map;

/** Neighborhood of one Application via {@code DEPENDS_ON} (incident edges). */
public record ApplicationNeighborhoodDto(
    NeighborhoodApplicationDto application,
    List<NeighborhoodEdgeDto> edges,
    boolean truncated) {

  public ApplicationNeighborhoodDto {
    edges = edges != null ? List.copyOf(edges) : List.of();
  }

  public record NeighborhoodApplicationDto(String id, String name, String description) {}

  public record NeighborhoodEdgeDto(
      String edgeId,
      String direction,
      String otherApplicationId,
      String otherName,
      Map<String, String> properties) {

    public NeighborhoodEdgeDto {
      properties = properties != null ? Map.copyOf(properties) : Map.of();
    }
  }
}
