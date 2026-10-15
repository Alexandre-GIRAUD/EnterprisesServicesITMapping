package com.enterprise.itmapping.feature.table.presentation.dto;

import com.enterprise.itmapping.feature.table.CustomTableShareLimits;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCustomTableShareRequest(
    @NotBlank @Size(max = CustomTableShareLimits.MAX_USERNAME_LENGTH) String username,
    @NotBlank @Size(max = CustomTableShareLimits.MAX_NAME_LENGTH) String name,
    @NotNull JsonNode document) {}
