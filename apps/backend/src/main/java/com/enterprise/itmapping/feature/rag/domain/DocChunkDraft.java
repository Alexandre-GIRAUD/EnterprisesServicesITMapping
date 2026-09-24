package com.enterprise.itmapping.feature.rag.domain;

/** One text unit prepared for embedding / indexing. */
public record DocChunkDraft(
    String sectionKey, String sectionTitle, int chunkIndex, String content, String contentHash) {}
