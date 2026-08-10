package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

/** Fetches a commit's file list + patches from the GitHub Commits API. */
@Service
public class GitHubCommitDiffService {

  private static final Logger log = LoggerFactory.getLogger(GitHubCommitDiffService.class);

  public record DiffFile(String path, String status, String patch, int changes) {}

  public record DiffResult(List<DiffFile> files, boolean truncated) {}

  private final GitHubApiClient apiClient;
  private final GitHubIntegrationProperties properties;

  public GitHubCommitDiffService(
      GitHubApiClient apiClient, GitHubIntegrationProperties properties) {
    this.apiClient = apiClient;
    this.properties = properties;
  }

  public DiffResult fetchCommitDiff(String owner, String repo, String sha) {
    if (!apiClient.hasToken()) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "GITHUB_TOKEN is not configured.");
    }
    JsonNode body;
    try {
      body =
          apiClient
              .buildClient()
              .get()
              .uri("/repos/{owner}/{repo}/commits/{sha}", owner, repo, sha)
              .retrieve()
              .body(JsonNode.class);
    } catch (RestClientResponseException e) {
      log.warn(
          "GitHub commit fetch failed owner={} repo={} sha={} status={}",
          owner,
          repo,
          sha,
          e.getStatusCode().value());
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Unable to fetch commit diff from GitHub.", e);
    }
    if (body == null || !body.has("files")) {
      return new DiffResult(List.of(), false);
    }
    int maxFiles = Math.max(1, properties.maxDiffFiles());
    int maxBytes = Math.max(1024, properties.maxDiffKb() * 1024);
    List<DiffFile> out = new ArrayList<>();
    int totalPatch = 0;
    boolean truncated = false;
    for (JsonNode file : body.get("files")) {
      if (out.size() >= maxFiles) {
        truncated = true;
        break;
      }
      String path = text(file, "filename");
      if (path.isBlank()) {
        continue;
      }
      String status = text(file, "status");
      String patch = text(file, "patch");
      int changes = file.path("changes").asInt(0);
      if (totalPatch + patch.length() > maxBytes) {
        truncated = true;
        int remain = Math.max(0, maxBytes - totalPatch);
        patch = patch.substring(0, Math.min(patch.length(), remain));
        out.add(new DiffFile(path, status, patch, changes));
        break;
      }
      totalPatch += patch.length();
      out.add(new DiffFile(path, status, patch, changes));
    }
    return new DiffResult(List.copyOf(out), truncated);
  }

  private static String text(JsonNode node, String field) {
    JsonNode v = node.get(field);
    return v == null || v.isNull() ? "" : v.asText("");
  }
}
