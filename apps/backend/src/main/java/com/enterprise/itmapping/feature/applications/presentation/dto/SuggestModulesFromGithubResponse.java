package com.enterprise.itmapping.feature.applications.presentation.dto;

import java.util.List;

/**
 * Summary of synchronous module suggestion persisted to Neo4j. {@code analyzedFiles} lists the
 * repository files whose content was read during the agentic selection loop (traceability only).
 */
public record SuggestModulesFromGithubResponse(
    List<CreatedItem> created, List<SkippedItem> skipped, List<String> analyzedFiles) {

  public record CreatedItem(String neo4jModuleId, String slugId, String businessName) {}

  public record SkippedItem(String scope, String reason, String detail) {}
}
