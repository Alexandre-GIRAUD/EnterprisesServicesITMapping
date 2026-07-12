package com.enterprise.itmapping.feature.integrations.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Budgets and guard-rails for the Spring AI connection-discovery agent (application-to-application
 * integration edges). Model transport (API key, base URL, model, temperature) is configured through
 * the standard {@code spring.ai.openai.*} properties; this record only holds the
 * repository-exploration and catalogue limits. Repository read/grep/tree budgets are shared with
 * {@link ModuleDiscoveryProperties}.
 */
@ConfigurationProperties(prefix = "app.integrations.llm.connection-discovery")
public record ConnectionDiscoveryProperties(
    /** Advisory cap on the number of tool round-trips (guidance passed to the model via prompt). */
    @DefaultValue("35") int maxToolIterations,
    /** Max grep matches returned to the model per {@code grep} tool call. */
    @DefaultValue("50") int maxGrepHits,
    /** Max UTF-8 characters returned per {@code readFile} tool call (truncated beyond). */
    @DefaultValue("12000") int maxReadCharsPerFile,
    /** Max entries returned per {@code listTree} tool call. */
    @DefaultValue("500") int maxTreeEntries,
    /** Timeout for the shallow {@code git clone}. */
    @DefaultValue("120") int cloneTimeoutSeconds,
    /** When true, connections with {@code confidence=low} are skipped instead of persisted. */
    @DefaultValue("false") boolean skipLowConfidence,
    /** Max number of catalogue applications inlined in the user prompt. */
    @DefaultValue("500") int maxCatalogAppsInPrompt) {}
