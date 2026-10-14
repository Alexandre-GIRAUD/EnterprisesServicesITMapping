package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

/** Exchanges an OAuth code for an access token, then reads the GitHub login. */
@Component
public class GitHubOAuthClient {

  private static final String USER_AGENT =
      "FlowraGraphDb-Backend (https://github.com; Spring RestClient)";

  private final GitHubIntegrationProperties properties;
  private final RestClient http = RestClient.create();

  public GitHubOAuthClient(GitHubIntegrationProperties properties) {
    this.properties = properties;
  }

  public GitHubIdentity exchange(String code) {
    AccessTokenResponse token =
        http.post()
            .uri("https://github.com/login/oauth/access_token")
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.APPLICATION_JSON)
            .body(
                Map.of(
                    "client_id", properties.clientId(),
                    "client_secret", properties.clientSecret(),
                    "code", code,
                    "redirect_uri", properties.oauthRedirectUri()))
            .retrieve()
            .body(AccessTokenResponse.class);
    if (token == null || !StringUtils.hasText(token.accessToken())) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub did not return an access token.");
    }
    UserResponse user =
        http.get()
            .uri("https://api.github.com/user")
            .header("Authorization", "Bearer " + token.accessToken())
            .header("Accept", MediaType.APPLICATION_JSON_VALUE)
            .header("User-Agent", USER_AGENT)
            .retrieve()
            .body(UserResponse.class);
    if (user == null || !StringUtils.hasText(user.login())) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub did not return a login.");
    }
    return new GitHubIdentity(user.login(), token.accessToken());
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record AccessTokenResponse(@JsonProperty("access_token") String accessToken) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record UserResponse(String login) {}
}
