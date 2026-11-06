package com.enterprise.itmapping.feature.signup.presentation.dto;

import com.enterprise.itmapping.feature.auth.domain.UserRole;
import com.enterprise.itmapping.feature.signup.domain.InvitationStatus;
import java.time.Instant;
import java.util.UUID;

public record InvitationResponse(
    UUID id, String email, UserRole role, InvitationStatus status, Instant expiresAt) {}
