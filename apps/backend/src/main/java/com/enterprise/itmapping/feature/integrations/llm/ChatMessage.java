package com.enterprise.itmapping.feature.integrations.llm;

import java.util.Set;

/**
 * Single chat message sent to the LLM. {@code role} must be one of {@code system}, {@code user} or
 * {@code assistant}. Immutable; used to build multi-turn conversations for the agentic selection
 * loop without re-injecting the whole repository context on every turn.
 */
public record ChatMessage(String role, String content) {

  private static final Set<String> VALID_ROLES = Set.of("system", "user", "assistant");

  public ChatMessage {
    if (role == null || !VALID_ROLES.contains(role)) {
      throw new IllegalArgumentException("Invalid chat role: " + role);
    }
    content = content != null ? content : "";
  }

  public static ChatMessage system(String content) {
    return new ChatMessage("system", content);
  }

  public static ChatMessage user(String content) {
    return new ChatMessage("user", content);
  }

  public static ChatMessage assistant(String content) {
    return new ChatMessage("assistant", content);
  }
}
