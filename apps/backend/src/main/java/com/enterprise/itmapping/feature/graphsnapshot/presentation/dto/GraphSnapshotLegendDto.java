package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import java.util.Map;

/**
 * Display-only legend coding pinned with a saved view (attribute keys + per-value colors).
 * Does not mutate Neo4j / Data Model attributes.
 */
public record GraphSnapshotLegendDto(
    String edgeColorKey,
    String edgeLabelKey,
    String appFillKey,
    String appBorderKey,
    Map<String, Map<String, String>> colors,
    Boolean hideEdgeLabels) {}
