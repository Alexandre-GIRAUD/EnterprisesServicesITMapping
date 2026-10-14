package com.enterprise.itmapping.feature.graph.application.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.LinkedHashMap;
import java.util.List;
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
     * non-structural property). A string is one value. A list is several. Empty on module-graph.
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, Object> properties,
    /** Catalogue names (Data Model {@code target=NODE_REF}): field key → ref names. */
    @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, List<String>> nodeRefs
) {

  public GraphNodeDto {
    properties = copyProperties(properties);
    nodeRefs = copyRefs(nodeRefs);
  }

  public GraphNodeDto(
      String id,
      String label,
      String type,
      String description,
      Map<String, ?> properties) {
    this(id, label, type, description, copyProperties(properties), Map.of());
  }

  private static Map<String, Object> copyProperties(Map<String, ?> properties) {
    if (properties == null || properties.isEmpty()) {
      return Map.of();
    }
    Map<String, Object> copy = new LinkedHashMap<>();
    properties.forEach(copy::put);
    return Map.copyOf(copy);
  }

  public GraphNodeDto(String id, String label, String type, String description) {
    this(id, label, type, description, Map.of(), Map.of());
  }

  private static Map<String, List<String>> copyRefs(Map<String, List<String>> nodeRefs) {
    if (nodeRefs == null || nodeRefs.isEmpty()) {
      return Map.of();
    }
    Map<String, List<String>> copy = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> entry : nodeRefs.entrySet()) {
      if (entry.getKey() == null || entry.getValue() == null || entry.getValue().isEmpty()) {
        continue;
      }
      copy.put(entry.getKey(), List.copyOf(entry.getValue()));
    }
    return copy.isEmpty() ? Map.of() : Map.copyOf(copy);
  }
}
