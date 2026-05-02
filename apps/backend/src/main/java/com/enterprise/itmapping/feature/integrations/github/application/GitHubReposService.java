package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.enterprise.itmapping.feature.integrations.github.dto.GitHubApiRepoJson;
import com.enterprise.itmapping.feature.integrations.github.dto.GitHubRepoDto;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient.ResponseSpec;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GitHubReposService {

  private final GitHubIntegrationProperties properties;

  public GitHubReposService(GitHubIntegrationProperties properties) {
    this.properties = properties;
  }

  /**
   * Lists repositories accessible to the configured token ({@code /user/repos}).
   *
   * <p>Pagination: only the first page is fetched ({@code per_page} capped by {@link
   * GitHubIntegrationProperties#maxRepos()}). Follow {@code Link rel="next"} for full catalog (TODO).
   */
  public List<GitHubRepoDto> listUserRepos() {
    String token =
        properties.token() != null ? properties.token().trim() : "";
    if (!StringUtils.hasText(token)) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Integration GitHub non configuree : definissez GITHUB_TOKEN (ou app.integrations.github.token) "
              + "cote backend. Le navigateur ne doit jamais recevoir ce secret.");
    }

    String base =
        properties.apiBaseUrl() != null && !properties.apiBaseUrl().isBlank()
            ? trimTrailing(properties.apiBaseUrl())
            : "https://api.github.com";
    int limit = Math.min(Math.max(properties.maxRepos(), 1), 100);
    RestClient client =
        RestClient.builder()
            .baseUrl(base)
            .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader("Authorization", "Bearer " + token)
            .defaultHeader(
                "User-Agent",
                "FlowraGraphDb-Backend (https://github.com; Spring RestClient)")
            .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
            .build();

    String uri =
        String.format(
            Locale.ROOT,
            "/user/repos?per_page=%d&sort=updated&direction=desc&type=owner",
            limit);

    try {
      ResponseSpec spec =
          client.get().uri(uri).accept(MediaType.APPLICATION_JSON).retrieve();
      GitHubApiRepoJson[] body = spec.body(GitHubApiRepoJson[].class);
      if (body == null) {
        return List.of();
      }
      return Arrays.stream(body)
          .map(
              r ->
                  new GitHubRepoDto(
                      r.id(),
                      r.fullName() != null ? r.fullName() : r.name(),
                      r.name() != null ? r.name() : "",
                      r.description() != null ? r.description() : "",
                      r.htmlUrl() != null ? r.htmlUrl() : "",
                      r.isPrivate()))
          .toList();
    } catch (RestClientResponseException e) {
      String bodySnippet = "";
      if (e.getResponseBodyAsString(StandardCharsets.UTF_8) != null) {
        bodySnippet = e.getResponseBodyAsString(StandardCharsets.UTF_8);
        if (bodySnippet.length() > 800) {
          bodySnippet = bodySnippet.substring(0, 800) + "…";
        }
      }
      int code = e.getStatusCode().value();
      if (code == 401 || code == 403) {
        throw new ResponseStatusException(
            HttpStatus.BAD_GATEWAY,
            "GitHub a refuse l'acces (401/403). Verifiez le token et les scopes (repo pour depots prives). "
                + bodySnippet);
      }
      if (code == 429) {
        throw new ResponseStatusException(
            HttpStatus.TOO_MANY_REQUESTS,
            "Limite de taux GitHub atteinte. Reessayez plus tard. " + bodySnippet);
      }
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY,
          "Erreur API GitHub " + code + ". " + bodySnippet);
    }
  }

  private static String trimTrailing(String url) {
    String u = url.trim();
    while (u.endsWith("/")) {
      u = u.substring(0, u.length() - 1);
    }
    return u;
  }
}
