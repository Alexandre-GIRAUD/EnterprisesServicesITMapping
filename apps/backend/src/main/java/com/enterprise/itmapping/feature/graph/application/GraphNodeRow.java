package com.enterprise.itmapping.feature.graph.application;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Raw node row from Cypher (before mapping to API DTO). */
public record GraphNodeRow(
    String id,
    String name,
    String description,
    /** Dynamic business properties of the Application node (Data Model driven), stringified. */
    Map<String, String> properties,
    /** Catalogue names (Data Model NODE_REF): field key → ref names. */
    Map<String, List<String>> nodeRefs
) {

  public GraphNodeRow {
    properties = properties != null ? Map.copyOf(properties) : Map.of();
    nodeRefs = copyRefs(nodeRefs);
  }

  public GraphNodeRow(String id, String name, String description, Map<String, String> properties) {
    this(id, name, description, properties, Map.of());
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
