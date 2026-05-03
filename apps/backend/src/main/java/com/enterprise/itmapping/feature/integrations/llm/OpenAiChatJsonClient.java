package com.enterprise.itmapping.feature.integrations.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Component
public class OpenAiChatJsonClient {

  private final LlmModuleSuggestionProperties properties;
  private final ObjectMapper objectMapper;

  public OpenAiChatJsonClient(
      LlmModuleSuggestionProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    int to = boundedTimeout(properties.timeoutMs());
    if (to <= 0) {
      throw new IllegalStateException("app.integrations.llm.timeout-ms invalide.");
    }
    this.objectMapper = objectMapper;
  }

  /** Returns assistant message text (JSON object string). */
  public String completeJson(String systemPrompt, String userPrompt) {
    String key = properties.apiKey() != null ? properties.apiKey().trim() : "";
    if (!StringUtils.hasText(key)) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "OPENAI_API_KEY ou app.integrations.llm.api-key non configure pour lappel LLM.");
    }

    String base = trimSlash(properties.baseUrl().isBlank() ? "https://api.openai.com" : properties.baseUrl());
    String path =
        properties.chatCompletionsPath().isBlank()
            ? "/v1/chat/completions"
            : properties.chatCompletionsPath().startsWith("/")
                ? properties.chatCompletionsPath()
                : "/" + properties.chatCompletionsPath();

    byte[] payload;
    try {
      payload = objectMapper.writeValueAsBytes(buildPayload(systemPrompt, userPrompt));
    } catch (JsonProcessingException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Serialisation payload LLM.", e);
    }

    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    int to = boundedTimeout(properties.timeoutMs());
    factory.setConnectTimeout(to);
    factory.setReadTimeout(to);

    RestClient client =
        RestClient.builder()
            .baseUrl(base)
            .requestFactory(factory)
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + key)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build();

    try {
      return extractContent(client.post().uri(path).body(payload).retrieve().body(byte[].class));
    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 429) {
        sleepQuiet(2000L);
        RestClient retry =
            RestClient.builder()
                .baseUrl(base)
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + key)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
        return extractContent(retry.post().uri(path).body(payload).retrieve().body(byte[].class));
      }
      throw translateOpenAi(e);
    }
  }

  private Map<String, Object> buildPayload(String systemPrompt, String userPrompt) {
    List<Map<String, String>> msgs = new ArrayList<>();
    msgs.add(Map.of("role", "system", "content", systemPrompt));
    msgs.add(Map.of("role", "user", "content", userPrompt));

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("model", properties.model());
    body.put("temperature", 0.2);
    body.put("max_tokens", Math.max(properties.maxCompletionTokens(), 512));
    body.put("messages", msgs);
    body.put("response_format", Map.of("type", "json_object"));
    return body;
  }

  private String extractContent(byte[] raw) {
    JsonNode root;
    try {
      root = objectMapper.readTree(raw != null ? raw : "{}".getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Reponse OpenAI JSON illisible.");
    }

    JsonNode choices = root.get("choices");
    if (choices == null || !choices.isArray() || choices.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Reponse OpenAI sans choices.");
    }

    JsonNode message = choices.get(0).get("message");
    if (message == null || message.get("content") == null) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Reponse OpenAI sans contenu.");
    }
    String content = Optional.ofNullable(message.get("content").asText()).orElse("").trim();
    if (!StringUtils.hasText(content)) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Contenu IA vide.");
    }
    return content;
  }

  private static ResponseStatusException translateOpenAi(RestClientResponseException e) {
    String snippet = "";
    if (e.getResponseBodyAsString(StandardCharsets.UTF_8) != null) {
      snippet = e.getResponseBodyAsString(StandardCharsets.UTF_8);
      if (snippet.length() > 500) {
        snippet = snippet.substring(0, 500) + "…";
      }
    }
    if (e.getStatusCode().value() == 401) {
      return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenAI 401 cle API invalide.", e);
    }
    return new ResponseStatusException(
        HttpStatus.BAD_GATEWAY,
        "OpenAI erreur HTTP " + e.getStatusCode().value() + " " + snippet);
  }

  private static void sleepQuiet(long ms) {
    try {
      Thread.sleep(ms);
    } catch (InterruptedException ie) {
      Thread.currentThread().interrupt();
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Interruption", ie);
    }
  }

  private static String trimSlash(String url) {
    String u = url.trim();
    while (u.endsWith("/")) {
      u = u.substring(0, u.length() - 1);
    }
    return u;
  }

  private static int boundedTimeout(int ms) {
    return Math.min(Math.max(ms, 1000), 600_000);
  }
}
