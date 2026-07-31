package com.enterprise.itmapping.feature.datamodel.domain;

import java.util.List;

/** Workspace singleton Data Model configuration. */
public record DataModelConfig(List<DataModelField> fields) {

  public DataModelConfig {
    fields = fields != null ? List.copyOf(fields) : List.of();
  }

  public boolean isEmpty() {
    return fields.isEmpty();
  }

  /** All automatic fields (any target). */
  public List<DataModelField> automaticFields() {
    return fields.stream().filter(DataModelField::isAutomaticDetection).toList();
  }

  public List<DataModelField> automaticEdgeFields() {
    return fields.stream()
        .filter(DataModelField::isAutomaticDetection)
        .filter(DataModelField::isEdgeTarget)
        .toList();
  }

  public List<DataModelField> automaticNodeFields() {
    return fields.stream()
        .filter(DataModelField::isAutomaticDetection)
        .filter(DataModelField::isNodeTarget)
        .toList();
  }

  public List<DataModelField> automaticNodeRefFields() {
    return fields.stream()
        .filter(DataModelField::isAutomaticDetection)
        .filter(DataModelField::isNodeRefTarget)
        .toList();
  }

  /** All NODE fields regardless of detection — graph filters accept automatic and manual alike. */
  public List<DataModelField> nodeFields() {
    return fields.stream().filter(DataModelField::isNodeTarget).toList();
  }

  /** All NODE_REF fields regardless of detection. */
  public List<DataModelField> nodeRefFields() {
    return fields.stream().filter(DataModelField::isNodeRefTarget).toList();
  }

  public boolean hasAutomaticFields() {
    return !automaticFields().isEmpty();
  }

  public boolean hasAutomaticEdgeFields() {
    return !automaticEdgeFields().isEmpty();
  }

  public boolean hasAutomaticNodeFields() {
    return !automaticNodeFields().isEmpty();
  }

  public boolean hasAutomaticNodeRefFields() {
    return !automaticNodeRefFields().isEmpty();
  }
}
