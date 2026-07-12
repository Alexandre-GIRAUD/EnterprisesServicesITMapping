package com.enterprise.itmapping.feature.applications.presentation.dto;

import java.util.List;

/**
 * Summary of synchronous connection suggestion persisted to Neo4j as {@code DEPENDS_ON} edges
 * between {@code Application} nodes. {@code analyzedFiles} lists the repository files whose content
 * was read during the agentic discovery loop (traceability only).
 */
public record SuggestConnectionsFromGithubResponse(
    List<CreatedConnectionItem> created, List<SkippedItem> skipped, List<String> analyzedFiles) {

  /**
   * A materialized {@code DEPENDS_ON} edge. {@code direction} is the analyzed-app perspective
   * ({@code outbound}/{@code inbound}); {@code sourceApplicationId}/{@code targetApplicationId} are
   * the actual Neo4j edge endpoints after orientation.
   */
  public record CreatedConnectionItem(
      String edgeId,
      String sourceApplicationId,
      String targetApplicationId,
      String peerName,
      String direction,
      String connectionKind,
      String channel) {}

  public record SkippedItem(String scope, String reason, String detail) {}
}
