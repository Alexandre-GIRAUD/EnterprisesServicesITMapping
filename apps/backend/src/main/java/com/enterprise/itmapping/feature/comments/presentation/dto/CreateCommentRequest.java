package com.enterprise.itmapping.feature.comments.presentation.dto;

import com.enterprise.itmapping.feature.comments.domain.CommentTargetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCommentRequest(
    @NotNull CommentTargetType targetType,
    @NotBlank @Size(max = 128) String targetId,
    @NotBlank @Size(max = 2000) String body) {}
