package com.enterprise.itmapping.feature.graph.application;

import java.util.Map;

/**
 * Projection of an edge for graph visualization (source, target, relationship type, optional data label).
 */
public record GraphEdgeProjection(
    String sourceId,
    String targetId,
    String type,
    String data,
    String relationshipId,
    Map<String, String> properties
) {
  /** Backward-compatible constructor for tests and module graph (no data label). */
  public GraphEdgeProjection(String sourceId, String targetId, String type) {
    this(sourceId, targetId, type, null, null, Map.of());
  }
}
