package com.enterprise.itmapping.feature.integrations.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Budgets for the functional-documentation agent. Model transport uses {@code spring.ai.openai.*}.
 */
@ConfigurationProperties(prefix = "app.integrations.llm.functional-documentation")
public record FunctionalDocumentationProperties(
    @DefaultValue("25") int maxToolIterations,
    @DefaultValue("50") int maxGrepHits,
    @DefaultValue("12000") int maxReadCharsPerFile,
    @DefaultValue("500") int maxTreeEntries,
    @DefaultValue("120") int cloneTimeoutSeconds,
    /** Output language for the generated documentation (v1: English). */
    @DefaultValue("en") String locale) {}
