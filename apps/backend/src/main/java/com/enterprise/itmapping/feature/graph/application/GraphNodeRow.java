package com.enterprise.itmapping.feature.graph.application;

import java.time.Instant;

/** Raw node row from Cypher (before mapping to API DTO). */
public record GraphNodeRow(
    String id,
    String name,
    String description,
    Instant validFrom,
    Instant validTo
) {}
