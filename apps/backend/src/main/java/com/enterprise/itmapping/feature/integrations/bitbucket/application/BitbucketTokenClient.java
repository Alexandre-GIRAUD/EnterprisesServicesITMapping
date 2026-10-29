package com.enterprise.itmapping.feature.integrations.bitbucket.application;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

/** Reads the Bitbucket username for a connection token. The token is not logged. */
@Component
public class BitbucketTokenClient {

  private final RestClient http = RestClient.create();

  public BitbucketIdentity identify(String accessToken) {
    try {
      UserResponse user =
          http.get()
              .uri("https://api.bitbucket.org/2.0/user")
              .header("Authorization", "Bearer " + accessToken)
              .header("Accept", MediaType.APPLICATION_JSON_VALUE)
              .retrieve()
              .body(UserResponse.class);
      if (user == null || !StringUtils.hasText(user.username())) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Bitbucket did not return a username.");
      }
      return new BitbucketIdentity(user.username(), accessToken);
    } catch (RestClientResponseException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bitbucket rejected this token.");
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record UserResponse(String username) {}
}
