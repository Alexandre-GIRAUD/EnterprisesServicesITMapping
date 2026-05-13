package com.enterprise.itmapping.feature.contributors.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record ContributorWriteRequest(
    @NotBlank String firstName,
    @NotBlank String lastName,
    String team,
    String businessUnitId,
    String managerContributorId,
    List<String> applicationIds) {

  public ContributorWriteRequest {
    applicationIds = applicationIds == null ? List.of() : List.copyOf(applicationIds);
  }
}
