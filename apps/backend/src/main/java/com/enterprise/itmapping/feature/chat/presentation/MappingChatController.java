package com.enterprise.itmapping.feature.chat.presentation;

import com.enterprise.itmapping.feature.chat.application.MappingChatService;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskRequest;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/chat")
public class MappingChatController {

  private final MappingChatService chatService;

  public MappingChatController(MappingChatService chatService) {
    this.chatService = chatService;
  }

  @PostMapping("/ask")
  public ChatAskResponse ask(@Valid @RequestBody ChatAskRequest request) {
    return chatService.ask(request);
  }
}
