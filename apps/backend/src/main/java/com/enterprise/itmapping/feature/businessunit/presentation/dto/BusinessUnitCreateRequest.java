package com.enterprise.itmapping.feature.businessunit.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record BusinessUnitCreateRequest(
    @NotBlank String name,
    String code,
    String description) {}
