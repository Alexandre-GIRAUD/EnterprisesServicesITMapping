package com.enterprise.itmapping.feature.integrations.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.integrations.llm")
public record LlmModuleSuggestionProperties(
    /** OpenAI or compatible chat API key — use env OPENAI_API_KEY. */
    String apiKey,
    @DefaultValue("https://api.openai.com") String baseUrl,
    @DefaultValue("/v1/chat/completions") String chatCompletionsPath,
    @DefaultValue("gpt-4o-mini") String model,
    @DefaultValue("120000") int timeoutMs,
    @DefaultValue("4096") int maxCompletionTokens,
    /** Max chars for user message listing paths (hard cap before LLM call). */
    @DefaultValue("120000") int maxUserPromptChars,
    /** After filtering, truncate to this many path lines sent to LLM. */
    @DefaultValue("800") int maxPathsInPrompt
) {}
