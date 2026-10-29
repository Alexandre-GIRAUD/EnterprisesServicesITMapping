package com.enterprise.itmapping.feature.integrations.bitbucket;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.integrations.bitbucket.application.BitbucketAccountService;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/** Token resolution and HTTP client for the Bitbucket Cloud REST API. */
@Component
public class BitbucketApiClient {

  private static final String DEFAULT_BASE_URL = "https://api.bitbucket.org/2.0";

  private final BitbucketIntegrationProperties properties;
  private final BitbucketAccountService accounts;
  private final UserRepository users;

  public BitbucketApiClient(
      BitbucketIntegrationProperties properties, BitbucketAccountService accounts, UserRepository users) {
    this.properties = properties;
    this.accounts = accounts;
    this.users = users;
  }

  /**
   * Token for the signed-in user when they have connected Bitbucket. Otherwise the server token.
   */
  public String token() {
    String personal = personalToken();
    if (StringUtils.hasText(personal)) {
      return personal;
    }
    return properties.token() != null ? properties.token().trim() : "";
  }

  public boolean hasToken() {
    return StringUtils.hasText(token());
  }

  public int maxRepos() {
    return Math.min(Math.max(properties.maxRepos(), 1), 100);
  }

  public RestClient buildClient() {
    return RestClient.builder()
        .baseUrl(apiBase())
        .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
        .defaultHeader("Authorization", "Bearer " + token())
        .build();
  }

  private String personalToken() {
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

  private String apiBase() {
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
}
