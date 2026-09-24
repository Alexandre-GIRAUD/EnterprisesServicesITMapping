package com.enterprise.itmapping.feature.graph.domain;

/** Direction filter for application neighborhood queries. */
public enum NeighborhoodDirection {
  BOTH,
  OUT,
  IN;

  public static NeighborhoodDirection fromParam(String raw) {
    if (raw == null || raw.isBlank()) {
      return BOTH;
    }
    return NeighborhoodDirection.valueOf(raw.trim().toUpperCase());
  }
}
