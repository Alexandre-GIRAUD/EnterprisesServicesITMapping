package com.enterprise.itmapping.feature.chat.application;

import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskRequest.ChatHistoryMessageDto;
import com.enterprise.itmapping.feature.integrations.llm.MappingChatProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Spring AI agent: read-only IT mapping Q&A with structured tools. */
@Component
public class MappingChatAgent {

  private static final Logger log = LoggerFactory.getLogger(MappingChatAgent.class);
  private static final String SYSTEM_PROMPT_LOCATION = "classpath:prompts/mapping-chat-system.txt";

  private final ChatClient chatClient;
  private final MappingChatProperties properties;
  private final String systemPrompt;

  public MappingChatAgent(
      ChatClient moduleDiscoveryChatClient,
      MappingChatProperties properties,
      ResourceLoader resourceLoader) {
    this.chatClient = moduleDiscoveryChatClient;
    this.properties = properties;
    this.systemPrompt = loadPrompt(resourceLoader);
  }

  public String ask(String userMessage, List<ChatHistoryMessageDto> history, MappingChatTools tools) {
    List<Message> prior = toMessages(history, properties.maxHistoryMessages());
    String guidance =
        """

        (Guidance: aim for at most %d tool calls. Prefer resolveApplications then targeted tools.)
        """
            .formatted(properties.maxToolIterations());

    log.info("Mapping chat agent start historyTurns={}", prior.size());
    try {
      var prompt = chatClient.prompt().system(systemPrompt + guidance);
      if (!prior.isEmpty()) {
        prompt = prompt.messages(prior);
      }
      return prompt.user(userMessage).tools(tools).call().content();
    } catch (Exception ex) {
      log.error("Mapping chat agent failed: {}", ex.getMessage());
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Chat service unavailable. Check LLM configuration.",
          ex);
    }
  }

  private static List<Message> toMessages(List<ChatHistoryMessageDto> history, int max) {
    if (history == null || history.isEmpty()) {
      return List.of();
    }
    int from = Math.max(0, history.size() - max);
    List<Message> out = new ArrayList<>();
    for (int i = from; i < history.size(); i++) {
      ChatHistoryMessageDto m = history.get(i);
      if (m == null || !StringUtils.hasText(m.content())) {
        continue;
      }
      String role = m.role() != null ? m.role().trim().toLowerCase() : "user";
      if ("assistant".equals(role)) {
        out.add(new AssistantMessage(m.content().trim()));
      } else if ("user".equals(role)) {
        out.add(new UserMessage(m.content().trim()));
      }
    }
    return out;
  }

  private static String loadPrompt(ResourceLoader resourceLoader) {
    try {
      Resource resource = resourceLoader.getResource(SYSTEM_PROMPT_LOCATION);
      return resource.getContentAsString(StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new IllegalStateException("Missing prompt " + SYSTEM_PROMPT_LOCATION, e);
    }
  }
}
