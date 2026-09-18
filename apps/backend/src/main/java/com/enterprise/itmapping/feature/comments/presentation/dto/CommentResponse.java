package com.enterprise.itmapping.feature.comments.presentation.dto;

import com.enterprise.itmapping.feature.comments.domain.CommentTargetType;
import java.time.Instant;
import java.util.UUID;

public record CommentResponse(
    UUID id,
    CommentTargetType targetType,
    String targetId,
    String body,
    String authorUsername,
    UUID authorUserId,
    Instant createdAt,
    Instant updatedAt,
    boolean edited,
    boolean canEdit,
    boolean canDelete) {}
