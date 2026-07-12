package com.enterprise.itmapping.feature.integrations.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Budgets and guard-rails for the Spring AI module-discovery agent. Model transport (API key,
 * base URL, model name, temperature) is configured through the standard {@code spring.ai.openai.*}
 * properties; this record only holds the repository-exploration limits.
 */
@ConfigurationProperties(prefix = "app.integrations.llm.module-discovery")
public record ModuleDiscoveryProperties(
    /** Advisory cap on the number of tool round-trips (guidance passed to the model via prompt). */
    @DefaultValue("25") int maxToolIterations,
    /** Max grep matches returned to the model per {@code grep} tool call. */
    @DefaultValue("50") int maxGrepHits,
    /** Max UTF-8 characters returned per {@code readFile} tool call (truncated beyond). */
    @DefaultValue("12000") int maxReadCharsPerFile,
    /** Max entries returned per {@code listTree} tool call. */
    @DefaultValue("500") int maxTreeEntries,
    /** Timeout for the shallow {@code git clone}. */
    @DefaultValue("120") int cloneTimeoutSeconds) {}
