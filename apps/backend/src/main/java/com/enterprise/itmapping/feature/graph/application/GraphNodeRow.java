package com.enterprise.itmapping.feature.graph.application;

import java.util.Map;

/** Raw node row from Cypher (before mapping to API DTO). */
public record GraphNodeRow(
    String id,
    String name,
    String description,
    /** Dynamic business properties of the Application node (Data Model driven), stringified. */
    Map<String, String> properties
) {

  public GraphNodeRow {
    properties = properties != null ? Map.copyOf(properties) : Map.of();
  }
}
