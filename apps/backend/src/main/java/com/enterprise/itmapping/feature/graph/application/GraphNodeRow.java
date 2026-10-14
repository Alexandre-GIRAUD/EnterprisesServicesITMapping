package com.enterprise.itmapping.feature.graph.application;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Raw node row from Cypher (before mapping to API DTO). */
public record GraphNodeRow(
    String id,
    String name,
    String description,
    /** Dynamic business properties. A string is one value. A list is several. */
    Map<String, Object> properties,
    /** Catalogue names (Data Model NODE_REF): field key → ref names. */
    Map<String, List<String>> nodeRefs
) {

  public GraphNodeRow {
    properties = copyProperties(properties);
    nodeRefs = copyRefs(nodeRefs);
  }

  public GraphNodeRow(String id, String name, String description, Map<String, ?> properties) {
    this(id, name, description, copyProperties(properties), Map.of());
  }

  private static Map<String, Object> copyProperties(Map<String, ?> properties) {
    if (properties == null || properties.isEmpty()) {
      return Map.of();
    }
    Map<String, Object> copy = new LinkedHashMap<>();
    properties.forEach(copy::put);
    return Map.copyOf(copy);
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
