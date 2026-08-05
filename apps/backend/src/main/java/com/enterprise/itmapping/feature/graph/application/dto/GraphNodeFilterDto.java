package com.enterprise.itmapping.feature.graph.application.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * One filterable dimension for the filter menu.
 *
 * @param kind {@code NODE} (flat Application props), {@code NODE_REF} (catalogue links), or {@code
 *     EDGE} (flat DEPENDS_ON props)
 * @param values for NODE/EDGE: string values; for NODE_REF: ref ids (same order as {@code options})
 * @param options for NODE_REF: id + display name; empty for NODE/EDGE
 * @param multiple when {@code true}, several values may be selected / linked
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record GraphNodeFilterDto(
    String key,
    String label,
    List<String> values,
    boolean fromAllowedValues,
    String kind,
    boolean multiple,
    List<GraphFilterOptionDto> options) {

  public GraphNodeFilterDto {
    values = values != null ? List.copyOf(values) : List.of();
    kind = kind != null && !kind.isBlank() ? kind : "NODE";
    options = options != null ? List.copyOf(options) : List.of();
  }

  /** Backward-compatible NODE constructor. */
  public GraphNodeFilterDto(
      String key, String label, List<String> values, boolean fromAllowedValues) {
    this(key, label, values, fromAllowedValues, "NODE", false, List.of());
  }

  public record GraphFilterOptionDto(String id, String name) {}
}
