package com.enterprise.itmapping.feature.integrations.bitbucket;

import com.enterprise.itmapping.feature.integrations.bitbucket.application.BitbucketAccountService;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

/** Token resolution and HTTP client for the Bitbucket Cloud REST API. */
@Component
public class BitbucketApiClient {

  private static final String DEFAULT_BASE_URL = "https://api.bitbucket.org/2.0";

  private final BitbucketIntegrationProperties properties;
  private final BitbucketAccountService accounts;

  public BitbucketApiClient(
      BitbucketIntegrationProperties properties, BitbucketAccountService accounts) {
    this.properties = properties;
    this.accounts = accounts;
  }

  /** The current workspace connection token; empty when the workspace has none. */
  public String token() {
    return accounts.accessToken();
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
