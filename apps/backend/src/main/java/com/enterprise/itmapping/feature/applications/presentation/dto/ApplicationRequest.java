package com.enterprise.itmapping.feature.applications.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record ApplicationRequest(
    @NotBlank String name,
    String description,
    Integer year
) {}
