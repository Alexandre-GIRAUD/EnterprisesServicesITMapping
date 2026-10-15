package com.enterprise.itmapping.feature.applications.presentation.dto;

import java.time.Instant;

public record DetectionDocumentResponse(
    String title, String body, int characterCount, Instant updatedAt) {

  public static DetectionDocumentResponse empty() {
    return new DetectionDocumentResponse(null, null, 0, null);
  }
}
