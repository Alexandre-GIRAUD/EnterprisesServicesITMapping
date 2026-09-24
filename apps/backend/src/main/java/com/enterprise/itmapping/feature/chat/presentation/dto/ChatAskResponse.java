package com.enterprise.itmapping.feature.chat.presentation.dto;

import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import java.util.List;

public record ChatAskResponse(
    String answerMarkdown, List<ChatCitationDto> citations, List<String> warnings) {

  public ChatAskResponse {
    citations = citations != null ? List.copyOf(citations) : List.of();
    warnings = warnings != null ? List.copyOf(warnings) : List.of();
  }

  public record ChatCitationDto(ChatCitationType type, String id, String label) {}
}
