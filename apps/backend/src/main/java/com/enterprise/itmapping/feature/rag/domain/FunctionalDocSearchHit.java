package com.enterprise.itmapping.feature.rag.domain;

/** Similarity hit from functional-doc vector search. */
public record FunctionalDocSearchHit(
    String applicationId,
    String applicationName,
    String sectionKey,
    String sectionTitle,
    String content,
    double score) {}
