package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import com.enterprise.itmapping.feature.integrations.github.GithubTreePathFilter;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class GitHubRepoTreeService {

  private final GitHubApiClient apiClient;

  public GitHubRepoTreeService(GitHubApiClient apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Fetches default branch and flat tree paths (blobs + trees) for the repository, filtered and
   * capped for LLM consumption.
   */
  public List<String> fetchFilteredTreePaths(String owner, String repo, int maxPathsInPrompt) {
    if (!apiClient.hasToken()) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "GITHUB_TOKEN requis pour lire larbre du depot.");
    }

    RestClient client = apiClient.buildClient();

    String defaultBranch = fetchDefaultBranch(client, owner, repo);
    String headTreeSha = resolveHeadTreeSha(client, owner, repo, defaultBranch);
    JsonNode tree = fetchTreeRecursive(client, owner, repo, headTreeSha);

    boolean truncated = tree.path("truncated").asBoolean(false);
    LinkedHashSet<String> pathsOrdered = new LinkedHashSet<>();

    JsonNode elements = tree.get("tree");
    if (elements != null && elements.isArray()) {
      for (JsonNode el : elements) {
        String ty = textOrEmpty(el.get("type"));
        if ("blob".equals(ty) || "tree".equals(ty)) {
          String path = textOrEmpty(el.get("path"));
          if (StringUtils.hasText(path)) {
            pathsOrdered.add(GithubTreePathFilter.normalizePath(path));
          }
        }
      }
    }

    List<String> prioritized =
        GithubTreePathFilter.prioritizeMonorepoRoots(new ArrayList<>(pathsOrdered));
    List<String> wider =
        GithubTreePathFilter.filterAndCap(
            prioritized,
            GithubTreePathFilter.DEFAULT_MAX_DEPTH,
            maxPathsInPrompt * 4);
    List<String> filtered =
        GithubTreePathFilter.filterAndCap(
            wider, GithubTreePathFilter.DEFAULT_MAX_DEPTH, maxPathsInPrompt);

    if (truncated && filtered.size() >= maxPathsInPrompt) {
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY,
          "Arbre GitHub tronque par GitHub (repo tres volumineux). "
              + "Affinez le depot ou augmentez maxPaths (MVP).");
    }

    return filtered;
  }

  private static String fetchDefaultBranch(RestClient client, String owner, String repo) {
    String uri =
        UriComponentsBuilder.fromPath("/repos/{owner}/{repo}")
            .buildAndExpand(owner, repo)
            .toUriString();
    JsonNode repoJson =
        Optional.ofNullable(client.get().uri(uri).retrieve().body(JsonNode.class))
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Reponse depot vide."));
    String branch = textOrEmpty(repoJson.get("default_branch"));
    if (!StringUtils.hasText(branch)) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Branche par defaut introuvable.");
    }
    return branch;
  }

  private static String resolveHeadTreeSha(
      RestClient client, String owner, String repo, String branchName) {
    String uri =
        UriComponentsBuilder.fromPath("/repos/{owner}/{repo}/git/ref/heads/{branch}")
            .buildAndExpand(owner, repo, branchName)
            .toUriString();

    JsonNode ref;
    try {
      ref =
          Optional.ofNullable(client.get().uri(uri).retrieve().body(JsonNode.class))
              .orElseThrow();
    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 404) {
        throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Depot ou branche GitHub introuvable (privilege token ou slug incorrect ?).");
      }
      throw e;
    }
    JsonNode object = ref.get("object");
    if (object == null || object.get("sha") == null) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "HEAD commit SHA introuvable.");
    }
    return object.get("sha").asText();
  }

  private static JsonNode fetchTreeRecursive(
      RestClient client, String owner, String repo, String treeSha) {
    String uri =
        String.format(
            Locale.ROOT,
            "/repos/%s/%s/git/trees/%s?recursive=1",
            urlEncodePathSegment(owner),
            urlEncodePathSegment(repo),
            urlEncodePathSegment(treeSha));

    try {
      return Optional.ofNullable(client.get().uri(uri).retrieve().body(JsonNode.class))
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Tree vide."));
    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 404) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tree GitHub introuvable.");
      }
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Erreur HTTP GitHub tree: " + e.getStatusCode());
    }
  }

  private static String urlEncodePathSegment(String s) {
    return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8)
        .replace("+", "%20");
  }

  private static String textOrEmpty(JsonNode n) {
    return n != null && n.isTextual() ? n.asText() : "";
  }
}
