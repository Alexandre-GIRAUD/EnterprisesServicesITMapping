package com.enterprise.itmapping.feature.auth.presentation.dto;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import java.time.Instant;
import java.util.UUID;

public record UserSummaryResponse(UUID id, String username, String role, Instant createdAt) {

  public static UserSummaryResponse from(UserEntity u) {
    return new UserSummaryResponse(
        u.getId(), u.getUsername(), u.getRole().name(), u.getCreatedAt());
  }
}
