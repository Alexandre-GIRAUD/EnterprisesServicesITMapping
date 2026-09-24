package com.enterprise.itmapping.feature.chat.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

/**
 * Chat ask body. {@code message} is the current user turn. {@code messages} is optional prior
 * history (user/assistant only), max N enforced server-side — do <b>not</b> include the current
 * {@code message} in {@code messages}.
 */
public record ChatAskRequest(
    @NotBlank String message, List<ChatHistoryMessageDto> messages) {

  public record ChatHistoryMessageDto(String role, String content) {}
}
