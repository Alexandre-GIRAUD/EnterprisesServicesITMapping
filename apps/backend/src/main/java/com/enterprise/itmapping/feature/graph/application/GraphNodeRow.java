package com.enterprise.itmapping.feature.graph.application;

/** Raw node row from Cypher (before mapping to API DTO). */
public record GraphNodeRow(
    String id,
    String name,
    String description,
    Integer year
) {}
