package com.enterprise.itmapping.feature.chat.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.chat.application.MappingChatService;
import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse.ChatCitationDto;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    controllers = MappingChatController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class)
class MappingChatControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean MappingChatService chatService;

  @Test
  void askReturnsAnswerAndCitations() throws Exception {
    when(chatService.ask(any()))
        .thenReturn(
            new ChatAskResponse(
                "Billing est connecté à CRM.",
                List.of(new ChatCitationDto(ChatCitationType.APPLICATION, "a1", "Billing")),
                List.of()));

    mockMvc
        .perform(
            post("/chat/ask")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Qui est connecté à Billing ?\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.answerMarkdown").value("Billing est connecté à CRM."))
        .andExpect(jsonPath("$.citations[0].type").value("APPLICATION"))
        .andExpect(jsonPath("$.citations[0].id").value("a1"));
  }

  @Test
  void askEmptyMessageReturns400() throws Exception {
    mockMvc
        .perform(
            post("/chat/ask")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"   \"}"))
        .andExpect(status().isBadRequest());
  }
}
