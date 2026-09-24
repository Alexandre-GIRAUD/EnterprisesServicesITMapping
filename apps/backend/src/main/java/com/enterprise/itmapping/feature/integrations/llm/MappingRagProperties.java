package com.enterprise.itmapping.feature.integrations.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Budgets for functional-documentation RAG (pgvector). */
@ConfigurationProperties(prefix = "app.integrations.llm.mapping-rag")
public record MappingRagProperties(
    @DefaultValue("true") boolean enabled,
    @DefaultValue("text-embedding-3-small") String embeddingModel,
    @DefaultValue("1536") int embeddingDimensions,
    @DefaultValue("8") int topK,
    @DefaultValue("0.25") double minScore,
    @DefaultValue("2000") int maxChunkChars,
    @DefaultValue("80") int maxChunksPerApp,
    @DefaultValue("true") boolean reindexOnReady,
    @DefaultValue("40") int minChunkChars,
    @DefaultValue("1200") int markdownWindowChars,
    @DefaultValue("200") int markdownOverlapChars) {}
