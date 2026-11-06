package com.enterprise.itmapping.feature.signup.application;

import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/** Builds the browser links sent by email: the public URL, a frontend page and a token. */
@Component
public class AccountLinks {

  /** Read by the frontend pages that redeem a link. */
  private static final String TOKEN_PARAMETER = "token";

  private final SignupProperties signupProperties;

  public AccountLinks(SignupProperties signupProperties) {
    this.signupProperties = signupProperties;
  }

  public String build(String path, String token) {
    return UriComponentsBuilder.fromUriString(signupProperties.publicUrl())
        .path(path)
        .queryParam(TOKEN_PARAMETER, token)
        .build()
        .toUriString();
  }
}
