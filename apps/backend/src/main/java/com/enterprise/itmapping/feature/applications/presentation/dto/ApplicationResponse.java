package com.enterprise.itmapping.feature.applications.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record ApplicationResponse(
    String id,
    String name,
    String description,
    /** True when IA module suggestion must be disabled ({@code CONTAINS*} to at least one {@code Module}). */
    boolean hasModuleSubtree,
    /**
     * Business attributes stored as flat properties on the {@code :Application} node ({@code
     * target=NODE}).
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    Map<String, Object> nodeAttributes,
    /**
     * Catalogue classifications via {@code CLASSIFIED_AS} ({@code target=NODE_REF}): field key →
     * linked refs.
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    Map<String, List<NodeRefSummary>> nodeRefs
) {

  public ApplicationResponse {
    nodeAttributes = copyAttributes(nodeAttributes);
    nodeRefs = nodeRefs != null ? Map.copyOf(nodeRefs) : Map.of();
  }

  /** Convenience when nodeRefs are empty. */
  public ApplicationResponse(
      String id,
      String name,
      String description,
      boolean hasModuleSubtree,
      Map<String, ?> nodeAttributes) {
    this(id, name, description, hasModuleSubtree, copyAttributes(nodeAttributes), Map.of());
  }

  private static Map<String, Object> copyAttributes(Map<String, ?> nodeAttributes) {
    if (nodeAttributes == null || nodeAttributes.isEmpty()) {
      return Map.of();
    }
    Map<String, Object> copy = new LinkedHashMap<>();
    nodeAttributes.forEach(copy::put);
    return Map.copyOf(copy);
  }

  public record NodeRefSummary(String id, String name, String value) {}
}
