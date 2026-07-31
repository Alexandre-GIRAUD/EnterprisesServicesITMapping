package com.enterprise.itmapping.feature.graph.application.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GraphNodeDto(
    String id,
    String label,
    String type,
    /** Neo4j node property; populated on module-graph only (omitted when null). */
    String description,
    /**
     * Dynamic business properties of the node (Data Model {@code target=NODE} keys and any other
     * non-structural property), stringified. Empty on module-graph.
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, String> properties
) {

  public GraphNodeDto {
    properties = properties != null ? Map.copyOf(properties) : Map.of();
  }

  public GraphNodeDto(String id, String label, String type, String description) {
    this(id, label, type, description, Map.of());
  }
}
