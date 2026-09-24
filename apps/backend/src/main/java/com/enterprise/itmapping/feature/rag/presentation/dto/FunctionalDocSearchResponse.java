package com.enterprise.itmapping.feature.rag.presentation.dto;

import java.util.List;

public record FunctionalDocSearchResponse(String query, List<HitDto> hits, String note) {

  public FunctionalDocSearchResponse {
    hits = hits != null ? List.copyOf(hits) : List.of();
  }

  public record HitDto(
      String applicationId,
      String applicationName,
      String sectionKey,
      String sectionTitle,
      String content,
      double score) {}
}
