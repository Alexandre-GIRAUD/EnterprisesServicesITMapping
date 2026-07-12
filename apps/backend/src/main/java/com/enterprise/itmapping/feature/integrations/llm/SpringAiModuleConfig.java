package com.enterprise.itmapping.feature.integrations.llm;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the Spring AI {@link ChatClient} used by the module-discovery agent. Model transport
 * (API key, base URL, model, temperature) is configured via {@code spring.ai.openai.*}; the
 * tool-calling loop (ReAct) is handled by Spring AI itself when tools are attached to a request.
 */
@Configuration
public class SpringAiModuleConfig {

  @Bean
  public ChatClient moduleDiscoveryChatClient(ChatClient.Builder builder) {
    return builder.build();
  }
}
