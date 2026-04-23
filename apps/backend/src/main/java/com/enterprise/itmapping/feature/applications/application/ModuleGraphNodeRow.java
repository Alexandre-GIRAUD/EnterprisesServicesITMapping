package com.enterprise.itmapping.feature.applications.application;

import java.time.Instant;

/** One row from module-graph Cypher (Application root or Module). */
public record ModuleGraphNodeRow(
    String id,
    String name,
    String description,
    Instant validFrom,
    Instant validTo,
    String nodeType
) {}
