package com.enterprise.itmapping.feature.integrations.github;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubAccountService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/**
 * Builds {@link RestClient} instances for the GitHub REST API with the shared base URL and headers
 * (Authorization, User-Agent, API version). Centralizes token resolution so the integration
 * services stay focused on their endpoints.
 */
@Component
public class GitHubApiClient {

  private static final String DEFAULT_BASE_URL = "https://api.github.com";
  private static final String USER_AGENT =
      "FlowraGraphDb-Backend (https://github.com; Spring RestClient)";
  private static final String API_VERSION = "2022-11-28";

  private final GitHubIntegrationProperties properties;
  private final GitHubAccountService accounts;
  private final UserRepository users;

  @Autowired
  public GitHubApiClient(
      GitHubIntegrationProperties properties, GitHubAccountService accounts, UserRepository users) {
    this.properties = properties;
    this.accounts = accounts;
    this.users = users;
  }

  /** Tests that only need the server token. */
  public GitHubApiClient(GitHubIntegrationProperties properties) {
    this(properties, null, null);
  }

  /**
   * Token for the signed-in user when they have connected GitHub. Otherwise the server token.
   * A webhook or other anonymous call keeps the server token.
   */
  public String token() {
    String personal = personalToken();
    if (StringUtils.hasText(personal)) {
      return personal;
    }
    return properties.token() != null ? properties.token().trim() : "";
  }

  private String personalToken() {
    if (accounts == null || users == null) {
      return "";
    }
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null
        || !auth.isAuthenticated()
        || auth instanceof AnonymousAuthenticationToken
        || !StringUtils.hasText(auth.getName())
        || "anonymousUser".equals(auth.getName())) {
      return "";
    }
    return users
        .findByUsernameIgnoreCase(auth.getName())
        .map(accounts::accessToken)
        .orElse("");
  }

  public boolean hasToken() {
    return StringUtils.hasText(token());
  }

  /** API base URL without trailing slash (defaults to {@code https://api.github.com}). */
  public String apiBase() {
    String raw = properties.apiBaseUrl();
    if (raw == null || raw.isBlank()) {
      return DEFAULT_BASE_URL;
    }
    String url = raw.trim();
    while (url.endsWith("/")) {
      url = url.substring(0, url.length() - 1);
    }
    return url;
  }

  /** RestClient pre-configured with the GitHub base URL and common headers. */
  public RestClient buildClient() {
    return RestClient.builder()
        .baseUrl(apiBase())
        .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
        .defaultHeader("Authorization", "Bearer " + token())
        .defaultHeader("User-Agent", USER_AGENT)
        .defaultHeader("X-GitHub-Api-Version", API_VERSION)
        .build();
  }
}
