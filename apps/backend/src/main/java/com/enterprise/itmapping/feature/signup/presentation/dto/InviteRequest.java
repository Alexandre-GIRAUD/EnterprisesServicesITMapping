package com.enterprise.itmapping.feature.signup.presentation.dto;

import com.enterprise.itmapping.feature.auth.domain.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InviteRequest(
    @NotBlank @Email @Size(max = 255) String email, @NotNull UserRole role) {}
