package com.enterprise.itmapping.feature.signup.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyEmailRequest(@NotBlank String token) {}
