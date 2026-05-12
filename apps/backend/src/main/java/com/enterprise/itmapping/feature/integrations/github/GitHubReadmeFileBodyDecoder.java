package com.enterprise.itmapping.feature.integrations.github;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

/**
 * Decodes GitHub JSON responses for a single file from {@code GET
 * /repos/{owner}/{repo}/contents/{path}} or {@code GET /repos/{owner}/{repo}/readme} when the
 * payload represents a file with base64 encoding.
 */
public final class GitHubReadmeFileBodyDecoder {

  private GitHubReadmeFileBodyDecoder() {}

  /** Returns UTF-8 plaintext when {@code root} is a file object with base64 content. */
  public static Optional<String> decodeUtf8Plaintext(JsonNode root) {
    if (root == null || root.isMissingNode()) {
      return Optional.empty();
    }
    if (!"file".equals(root.path("type").asText())) {
      return Optional.empty();
    }
    if (!"base64".equals(root.path("encoding").asText())) {
      return Optional.empty();
    }
    String raw = root.path("content").asText("");
    if (raw.isEmpty()) {
      return Optional.empty();
    }
    String compact = raw.replaceAll("\\s+", "");
    try {
      byte[] bytes = Base64.getMimeDecoder().decode(compact);
      return Optional.of(new String(bytes, StandardCharsets.UTF_8));
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }
  }
}
