package com.enterprise.itmapping.feature.graph.application;

/**
 * Projection of an edge for graph visualization (source, target, relationship type).
 */
public record GraphEdgeProjection(String sourceId, String targetId, String type) {
}
