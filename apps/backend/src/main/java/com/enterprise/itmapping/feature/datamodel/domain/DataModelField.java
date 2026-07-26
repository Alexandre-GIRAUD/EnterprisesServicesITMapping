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
    DataModelDetection detection,
    DataModelTarget target) {

  public DataModelField {
    description = description != null ? description : "";
    promptHint = promptHint != null ? promptHint : "";
    allowedValues = allowedValues != null ? List.copyOf(allowedValues) : List.of();
    detection = DataModelDetection.orDefault(detection);
    target = DataModelTarget.orDefault(target);
  }

  /** Convenience — automatic detection, EDGE target. */
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
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.EDGE);
  }

  /** Convenience — EDGE target with explicit detection. */
  public DataModelField(
      String key,
      String label,
      String description,
      String promptHint,
      List<String> allowedValues,
      boolean enforceEnum,
      boolean required,
      DataModelDetection detection) {
    this(
        key,
        label,
        description,
        promptHint,
        allowedValues,
        enforceEnum,
        required,
        detection,
        DataModelTarget.EDGE);
  }

  public boolean isAutomaticDetection() {
    return detection != DataModelDetection.MANUAL;
  }

  public boolean isEdgeTarget() {
    return target == DataModelTarget.EDGE;
  }

  public boolean isNodeTarget() {
    return target == DataModelTarget.NODE;
  }
}
