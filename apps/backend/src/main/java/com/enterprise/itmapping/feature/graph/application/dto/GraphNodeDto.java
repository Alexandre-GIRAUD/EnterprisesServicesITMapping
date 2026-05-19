package com.enterprise.itmapping.feature.graph.application.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GraphNodeDto(
    String id,
    String label,
    String type,
    TemporalDto temporal,
    /** Neo4j node property; populated on module-graph only (omitted when null). */
    String description
) {
  public record TemporalDto(String validFrom, String validTo) {}
}
