package com.enterprise.itmapping.feature.integrations.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Budgets for the read-only mapping chat agent (IT cartography Q&A). */
@ConfigurationProperties(prefix = "app.integrations.llm.mapping-chat")
public record MappingChatProperties(
    @DefaultValue("true") boolean enabled,
    @DefaultValue("8") int maxToolIterations,
    @DefaultValue("50") int maxNeighborhoodEdges,
    @DefaultValue("8000") int maxDocChars,
    @DefaultValue("10") int maxHistoryMessages,
    @DefaultValue("10") int maxResolveResults,
    @DefaultValue("40") int maxModulesInSummary) {}
