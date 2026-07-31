package com.enterprise.itmapping.feature.applications.application;

/** One row from module-graph Cypher (Application root or Module). */
public record ModuleGraphNodeRow(
    String id,
    String name,
    String description,
    String nodeType
) {}
