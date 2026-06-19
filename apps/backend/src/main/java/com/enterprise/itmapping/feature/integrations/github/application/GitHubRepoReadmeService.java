package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import com.enterprise.itmapping.feature.integrations.github.GitHubReadmeFileBodyDecoder;
import com.enterprise.itmapping.feature.integrations.github.GithubTreePathFilter;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Loads the repository root README as plaintext for LLM context. <strong>Coherence with the
 * filtered tree:</strong> we only return content when we can anchor it to a path that appears in
 * {@code knownPaths}:
 *
 * <ol>
 *   <li>If a root README filename (e.g. {@code README.md}) exists in {@code knownPaths}, use {@code
 *       GET /repos/{owner}/{repo}/contents/{path}}.
 *   <li>Otherwise call {@code GET /repos/{owner}/{repo}/readme}; use the body only if the API's
 *       {@code path} field (normalized) is contained in {@code knownPaths} (e.g. README listed under
 *       a different casing than our selector, or rare layout). If not listed, return empty.
 * </ol>
 */
@Service
public class GitHubRepoReadmeService {

  private final GitHubApiClient apiClient;

  public GitHubRepoReadmeService(GitHubApiClient apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * @param knownPaths normalized tree paths (same set sent to the LLM)
   * @param maxChars max UTF-16 code units to return (truncated)
   */
  public Optional<String> fetchRootReadmePlaintextForKnownPaths(
      String owner, String repo, Set<String> knownPaths, int maxChars) {
    if (!StringUtils.hasText(owner) || !StringUtils.hasText(repo) || knownPaths == null) {
      return Optional.empty();
    }
    if (!apiClient.hasToken()) {
      return Optional.empty();
    }
    int cap = Math.max(0, maxChars);
    if (cap == 0) {
      return Optional.empty();
    }

    RestClient client = apiClient.buildClient();

    Optional<String> fromContents =
        GitHubRootReadmePathSelector.selectRootReadmePath(knownPaths)
            .flatMap(path -> getContentsFileJson(client, owner, repo, path))
            .flatMap(GitHubReadmeFileBodyDecoder::decodeUtf8Plaintext);

    if (fromContents.isPresent()) {
      return Optional.of(truncate(fromContents.get(), cap));
    }

    Optional<JsonNode> readmeNode = getReadmeApiJson(client, owner, repo);
    if (readmeNode.isEmpty()) {
      return Optional.empty();
    }
    JsonNode node = readmeNode.get();
    String apiPath = GithubTreePathFilter.normalizePath(node.path("path").asText(""));
    if (apiPath.isEmpty() || !knownPaths.contains(apiPath)) {
      return Optional.empty();
    }
    return GitHubReadmeFileBodyDecoder.decodeUtf8Plaintext(node).map(s -> truncate(s, cap));
  }

  private static Optional<JsonNode> getContentsFileJson(
      RestClient client, String owner, String repo, String path) {
    String uri =
        UriComponentsBuilder.fromPath("/repos/{owner}/{repo}/contents/{path}")
            .buildAndExpand(owner, repo, path)
            .encode()
            .toUriString();
    try {
      JsonNode body = client.get().uri(uri).retrieve().body(JsonNode.class);
      return Optional.ofNullable(body);
    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 404) {
        return Optional.empty();
      }
      return Optional.empty();
    }
  }

  private static Optional<JsonNode> getReadmeApiJson(RestClient client, String owner, String repo) {
    String uri =
        UriComponentsBuilder.fromPath("/repos/{owner}/{repo}/readme")
            .buildAndExpand(owner, repo)
            .toUriString();
    try {
      JsonNode body = client.get().uri(uri).retrieve().body(JsonNode.class);
      return Optional.ofNullable(body);
    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 404) {
        return Optional.empty();
      }
      return Optional.empty();
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
