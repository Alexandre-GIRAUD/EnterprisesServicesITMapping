package com.enterprise.itmapping.feature.table.presentation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCustomTableShareRequest(
    @NotBlank @Size(max = 64) String username,
    @NotBlank @Size(max = 80) String name,
    @NotNull JsonNode document) {}
