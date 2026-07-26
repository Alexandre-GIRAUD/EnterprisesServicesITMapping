package com.enterprise.itmapping.feature.datamodel.domain;

import com.fasterxml.jackson.annotation.JsonCreator;

/**
 * Where a Data Model field applies in the graph.
 *
 * <p>{@link #EDGE} — connection flow attributes ({@code edge_attributes} → {@code DEPENDS_ON}).
 * {@link #NODE} — analyzed Application attributes ({@code node_attributes} → {@code :Application}).
 */
public enum DataModelTarget {
  EDGE,
  NODE;

  @JsonCreator
  public static DataModelTarget fromJson(String raw) {
    if (raw == null || raw.isBlank()) {
      return EDGE;
    }
    String normalized = raw.trim().toUpperCase().replace(' ', '_').replace('-', '_');
    return switch (normalized) {
      case "EDGE", "CONNECTION", "RELATIONSHIP" -> EDGE;
      case "NODE", "APPLICATION", "APP" -> NODE;
      default ->
          throw new IllegalArgumentException(
              "target invalide: " + raw + " (attendu EDGE|NODE)");
    };
  }

  public static DataModelTarget orDefault(DataModelTarget target) {
    return target != null ? target : EDGE;
  }
}
