package com.enterprise.itmapping.feature.graph.application.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GraphNodeDto(
    String id,
    String label,
    String type,
    TemporalDto temporal
) {
  public record TemporalDto(String validFrom, String validTo) {}
}
