package com.enterprise.itmapping.feature.datamodel.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** One user-defined field in the workspace Data Model. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DataModelField(
    String key,
    String label,
    String description,
    String promptHint,
    List<String> allowedValues,
    boolean enforceEnum,
    boolean required,
    DataModelDetection detection,
    DataModelTarget target,
    /** When {@code true} and {@code target=NODE_REF}, an Application may link to several refs. */
    boolean multiple) {

  public DataModelField {
    description = description != null ? description : "";
    promptHint = promptHint != null ? promptHint : "";
    allowedValues = allowedValues != null ? List.copyOf(allowedValues) : List.of();
    detection = DataModelDetection.orDefault(detection);
    target = DataModelTarget.orDefault(target);
  }

  /** Convenience — automatic detection, EDGE target, not multiple. */
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
        DataModelTarget.EDGE,
        false);
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
        DataModelTarget.EDGE,
        false);
  }

  /** Convenience — explicit detection + target, not multiple. */
  public DataModelField(
      String key,
      String label,
      String description,
      String promptHint,
      List<String> allowedValues,
      boolean enforceEnum,
      boolean required,
      DataModelDetection detection,
      DataModelTarget target) {
    this(
        key,
        label,
        description,
        promptHint,
        allowedValues,
        enforceEnum,
        required,
        detection,
        target,
        false);
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

  public boolean isNodeRefTarget() {
    return target == DataModelTarget.NODE_REF;
  }
}
