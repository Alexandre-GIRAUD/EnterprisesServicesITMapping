package com.enterprise.itmapping.feature.signup.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record ResendVerificationRequest(@NotBlank String email) {}
