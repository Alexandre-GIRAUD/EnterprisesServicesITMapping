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
    @DefaultValue("800") int maxPathsInPrompt,
    /** Max UTF-16 code units of root README text injected into the user prompt (0 disables). */
    @DefaultValue("8000") int maxReadmeCharsInPrompt,
    /** When true, run the agentic file-selection loop before the final analysis pass. */
    @DefaultValue("true") boolean enableAgenticFileReading,
    /** Max number of selection iterations (hard cap on LLM calls is this + 1). */
    @DefaultValue("3") int maxIterations,
    /** Max file paths the model may request per selection iteration. */
    @DefaultValue("10") int maxFilesPerIteration,
    /** Max total files read across all iterations. */
    @DefaultValue("25") int maxFilesTotal,
    /** Max UTF-16 code units kept per file (truncated). */
    @DefaultValue("12000") int maxCharsPerFile,
    /** Max total UTF-16 code units of file content read across all iterations. */
    @DefaultValue("80000") int maxTotalContentChars,
    /**
     * Max UTF-16 code units of the selection chat history (excluding the system prompt). When
     * exceeded, the oldest middle turns are dropped while keeping the first user turn (tree +
     * README) and the most recent turns.
     */
    @DefaultValue("60000") int maxSelectionHistoryChars
) {}
