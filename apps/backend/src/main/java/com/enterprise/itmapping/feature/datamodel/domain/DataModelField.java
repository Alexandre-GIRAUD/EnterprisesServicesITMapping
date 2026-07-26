package com.enterprise.itmapping.feature.datamodel.domain;

import java.util.List;

/** One user-defined field in the workspace Data Model. */
public record DataModelField(
    String key,
    String label,
    String description,
    String promptHint,
    List<String> allowedValues,
    boolean enforceEnum,
    boolean required,
    DataModelDetection detection) {

  public DataModelField {
    description = description != null ? description : "";
    promptHint = promptHint != null ? promptHint : "";
    allowedValues = allowedValues != null ? List.copyOf(allowedValues) : List.of();
    detection = DataModelDetection.orDefault(detection);
  }

  /** Convenience constructor — defaults to {@link DataModelDetection#AUTOMATIC_DETECTION}. */
  public DataModelField(
      String key,
      String label,
      String description,
      String promptHint,
      List<String> allowedValues,
      boolean enforceEnum,
      boolean required) {
    this(
        key,
        label,
        description,
        promptHint,
        allowedValues,
        enforceEnum,
        required,
        DataModelDetection.AUTOMATIC_DETECTION);
  }

  /** True when the AI connection pipeline should search for this field. */
  public boolean isAutomaticDetection() {
    return detection != DataModelDetection.MANUAL;
  }
}
