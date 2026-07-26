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

  /** Fields the AI may discover (excludes {@link DataModelDetection#MANUAL}). */
  public List<DataModelField> automaticFields() {
    return fields.stream().filter(DataModelField::isAutomaticDetection).toList();
  }

  /**
   * True when at least one field is automatic — otherwise connection suggestion stays topology-only
   * (same as an empty Data Model for AI enrichment).
   */
  public boolean hasAutomaticFields() {
    return !automaticFields().isEmpty();
  }
}
