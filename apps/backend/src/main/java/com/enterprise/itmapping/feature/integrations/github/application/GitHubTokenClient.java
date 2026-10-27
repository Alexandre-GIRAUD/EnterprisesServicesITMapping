package com.enterprise.itmapping.feature.integrations.github.application;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

/** Reads the GitHub login for a token the user pasted. The token is not logged. */
@Component
public class GitHubTokenClient {

  private static final String USER_AGENT =
      "FlowraGraphDb-Backend (https://github.com; Spring RestClient)";

  private final RestClient http = RestClient.create();

  public GitHubIdentity identify(String accessToken) {
    try {
      UserResponse user =
          http.get()
              .uri("https://api.github.com/user")
              .header("Authorization", "Bearer " + accessToken)
              .header("Accept", MediaType.APPLICATION_JSON_VALUE)
              .header("User-Agent", USER_AGENT)
              .retrieve()
              .body(UserResponse.class);
      if (user == null || !StringUtils.hasText(user.login())) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub did not return a login.");
      }
      return new GitHubIdentity(user.login(), accessToken);
    } catch (RestClientResponseException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "GitHub rejected this token.");
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record UserResponse(String login) {}
}
