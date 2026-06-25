package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import com.enterprise.itmapping.feature.integrations.github.GitHubReadmeFileBodyDecoder;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Reads the plaintext content of selected repository files via {@code GET
 * /repos/{owner}/{repo}/contents/{path}}. Used by the agentic module-suggestion loop so the LLM can
 * inspect source files it chose itself.
 *
 * <p>Robustness: missing files (404), binary blobs, files larger than the GitHub Contents API limit
 * (~1 MB, where {@code content} is empty) and undecodable payloads are skipped silently. Each file
 * is truncated to {@code maxCharsPerFile} UTF-16 code units. The returned map preserves the request
 * order.
 */
@Service
public class GitHubRepoFileContentService {

  private final GitHubApiClient apiClient;

  public GitHubRepoFileContentService(GitHubApiClient apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * @param paths normalized tree paths to read (already validated against the tree by the caller)
   * @param maxCharsPerFile per-file truncation cap (UTF-16 code units); {@code <= 0} returns empty
   * @return ordered map of {@code path -> truncated content}; only successfully decoded files appear
   */
  public Map<String, String> fetchFileContents(
      String owner, String repo, List<String> paths, int maxCharsPerFile) {
    Map<String, String> result = new LinkedHashMap<>();
    if (!StringUtils.hasText(owner)
        || !StringUtils.hasText(repo)
        || paths == null
        || paths.isEmpty()
        || maxCharsPerFile <= 0
        || !apiClient.hasToken()) {
      return result;
    }

    RestClient client = apiClient.buildClient();
    for (String path : paths) {
      if (!StringUtils.hasText(path) || result.containsKey(path)) {
        continue;
      }
      fetchSingleFile(client, owner, repo, path)
          .flatMap(GitHubReadmeFileBodyDecoder::decodeUtf8Plaintext)
          .ifPresent(content -> result.put(path, truncate(content, maxCharsPerFile)));
    }
    return result;
  }

  private static java.util.Optional<JsonNode> fetchSingleFile(
      RestClient client, String owner, String repo, String path) {
    String uri =
        UriComponentsBuilder.fromPath("/repos/{owner}/{repo}/contents/{path}")
            .buildAndExpand(owner, repo, path)
            .encode()
            .toUriString();
    try {
      JsonNode body = client.get().uri(uri).retrieve().body(JsonNode.class);
      return java.util.Optional.ofNullable(body);
    } catch (RestClientResponseException e) {
      // 404 (missing), 403 (too large/forbidden) and other client errors are non-fatal: skip.
      return java.util.Optional.empty();
    } catch (Exception e) {
      return java.util.Optional.empty();
    }
  }

  private static String truncate(String s, int maxChars) {
    if (s == null || s.isEmpty() || maxChars <= 0) {
      return "";
    }
    if (s.length() <= maxChars) {
      return s;
    }
    return s.substring(0, maxChars) + "\n... (truncated for prompt size limit)\n";
  }
}
