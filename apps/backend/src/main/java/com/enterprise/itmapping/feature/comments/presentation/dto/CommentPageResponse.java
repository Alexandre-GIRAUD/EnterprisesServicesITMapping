package com.enterprise.itmapping.feature.comments.presentation.dto;

import java.util.List;

public record CommentPageResponse(
    List<CommentResponse> items, int page, int size, long totalElements, boolean hasMore) {}
