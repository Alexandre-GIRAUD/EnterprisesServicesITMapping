package com.enterprise.itmapping.feature.datamodel.domain;

import com.fasterxml.jackson.annotation.JsonCreator;

/**
 * Where a Data Model field applies in the graph.
 *
 * <p>{@link #EDGE} — connection flow attributes ({@code edge_attributes} → {@code DEPENDS_ON}).
 * {@link #NODE} — analyzed Application attributes ({@code node_attributes} → flat props on {@code
 * :Application}).
 * {@link #NODE_REF} — declared catalogue values materialized as {@code :DataModelRef} nodes, linked
 * via {@code CLASSIFIED_AS}.
 */
public enum DataModelTarget {
  EDGE,
  NODE,
  NODE_REF;

  @JsonCreator
  public static DataModelTarget fromJson(String raw) {
    if (raw == null || raw.isBlank()) {
      return EDGE;
    }
    String normalized = raw.trim().toUpperCase().replace(' ', '_').replace('-', '_');
    return switch (normalized) {
      case "EDGE", "CONNECTION", "RELATIONSHIP" -> EDGE;
      case "NODE", "APPLICATION", "APP" -> NODE;
      case "NODE_REF", "NODEREF", "REF", "REFERENCE", "APPLICATION_REF" -> NODE_REF;
      default ->
          throw new IllegalArgumentException(
              "target invalide: " + raw + " (attendu EDGE|NODE|NODE_REF)");
    };
  }

  public static DataModelTarget orDefault(DataModelTarget target) {
    return target != null ? target : EDGE;
  }
}
