package com.enterprise.itmapping.feature.auth.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
    @NotBlank @Size(min = 2, max = 64) String username,
    @NotBlank @Size(min = 8, max = 128) String password) {}
