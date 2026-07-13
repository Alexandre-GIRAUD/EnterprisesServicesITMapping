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
}
