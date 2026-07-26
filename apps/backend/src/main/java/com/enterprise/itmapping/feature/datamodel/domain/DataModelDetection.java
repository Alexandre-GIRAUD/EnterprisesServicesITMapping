package com.enterprise.itmapping.feature.datamodel.domain;

import com.fasterxml.jackson.annotation.JsonCreator;

/**
 * How a Data Model field participates in AI connection discovery.
 *
 * <p>{@link #AUTOMATIC_DETECTION} — field is injected into the agent prompt and validated on
 * {@code edge_attributes}. {@link #MANUAL} — field is stored in config only; AI must not search or
 * emit it ({@code required} is ignored for suggestion).
 */
public enum DataModelDetection {
  AUTOMATIC_DETECTION,
  MANUAL;

  @JsonCreator
  public static DataModelDetection fromJson(String raw) {
    if (raw == null || raw.isBlank()) {
      return AUTOMATIC_DETECTION;
    }
    String normalized = raw.trim().toUpperCase().replace(' ', '_').replace('-', '_');
    return switch (normalized) {
      case "AUTOMATIC_DETECTION", "AUTOMATIC", "AUTO" -> AUTOMATIC_DETECTION;
      case "MANUAL" -> MANUAL;
      default ->
          throw new IllegalArgumentException(
              "detection invalide: " + raw + " (attendu AUTOMATIC_DETECTION|MANUAL)");
    };
  }

  public static DataModelDetection orDefault(DataModelDetection detection) {
    return detection != null ? detection : AUTOMATIC_DETECTION;
  }
}
