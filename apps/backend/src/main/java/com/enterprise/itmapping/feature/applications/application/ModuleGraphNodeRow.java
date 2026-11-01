package com.enterprise.itmapping.feature.applications.application;

import java.util.List;

/** One row from module-graph Cypher (Application root or Module). */
public record ModuleGraphNodeRow(
    String id,
    String name,
    String description,
    String nodeType,
    String owner,
    String technology,
    List<String> dataIn,
    List<String> dataOut) {

  public ModuleGraphNodeRow(String id, String name, String description, String nodeType) {
    this(id, name, description, nodeType, null, null, List.of(), List.of());
  }
}
