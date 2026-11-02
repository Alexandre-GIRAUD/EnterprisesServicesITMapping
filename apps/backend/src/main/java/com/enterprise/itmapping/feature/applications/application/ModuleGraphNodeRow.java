package com.enterprise.itmapping.feature.applications.application;

import java.util.Map;

/**
 * One row from module-graph Cypher (Application root or Module). {@code properties} holds the
 * functional details stored on the node (owner, actors, data in / out, business objects...).
 */
public record ModuleGraphNodeRow(
    String id, String name, String description, String nodeType, Map<String, Object> properties) {

  public ModuleGraphNodeRow {
    properties = properties != null ? Map.copyOf(properties) : Map.of();
  }

  public ModuleGraphNodeRow(String id, String name, String description, String nodeType) {
    this(id, name, description, nodeType, Map.of());
  }
}
