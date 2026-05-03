package com.enterprise.itmapping.feature.applications.presentation.dto;

import java.util.List;

/** Summary of synchronous module suggestion persisted to Neo4j. */
public record SuggestModulesFromGithubResponse(List<CreatedItem> created, List<SkippedItem> skipped) {

  public record CreatedItem(String neo4jModuleId, String slugId, String businessName) {}

  public record SkippedItem(String scope, String reason, String detail) {}
}
