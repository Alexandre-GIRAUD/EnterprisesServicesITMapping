package com.enterprise.itmapping.feature.applications.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
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
    Map<String, String> nodeAttributes,
    /**
     * Catalogue classifications via {@code CLASSIFIED_AS} ({@code target=NODE_REF}): field key →
     * linked refs.
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    Map<String, List<NodeRefSummary>> nodeRefs
) {

  public ApplicationResponse {
    nodeAttributes = nodeAttributes != null ? Map.copyOf(nodeAttributes) : Map.of();
    nodeRefs = nodeRefs != null ? Map.copyOf(nodeRefs) : Map.of();
  }

  /** Convenience when nodeRefs are empty. */
  public ApplicationResponse(
      String id,
      String name,
      String description,
      boolean hasModuleSubtree,
      Map<String, String> nodeAttributes) {
    this(id, name, description, hasModuleSubtree, nodeAttributes, Map.of());
  }

  public record NodeRefSummary(String id, String name, String value) {}
}
