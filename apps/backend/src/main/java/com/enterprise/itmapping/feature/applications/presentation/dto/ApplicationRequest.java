package com.enterprise.itmapping.feature.applications.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

public record ApplicationRequest(
    @NotBlank String name,
    String description,
    Instant validFrom,
    Instant validTo
) {
  public Instant validFrom() {
    return validFrom != null ? validFrom : Instant.now();
  }

  public Instant validTo() {
    return validTo;
  }
}
