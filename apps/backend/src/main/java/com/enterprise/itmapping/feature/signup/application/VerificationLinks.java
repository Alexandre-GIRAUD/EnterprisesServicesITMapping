package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/** Issues a fresh token for a pending account and mails the link that redeems it. */
@Component
public class VerificationLinks {

  private static final String VERIFY_PATH = "/verify-email";
  /** Read by the frontend /verify-email page. */
  private static final String TOKEN_PARAMETER = "token";

  private final VerificationTokens tokens;
  private final VerificationMailer mailer;
  private final SignupProperties signupProperties;

  public VerificationLinks(
      VerificationTokens tokens, VerificationMailer mailer, SignupProperties signupProperties) {
    this.tokens = tokens;
    this.mailer = mailer;
    this.signupProperties = signupProperties;
  }

  public void send(UserEntity user) {
    String link =
        UriComponentsBuilder.fromUriString(signupProperties.publicUrl())
            .path(VERIFY_PATH)
            .queryParam(TOKEN_PARAMETER, tokens.issue(user))
            .build()
            .toUriString();
    mailer.sendVerificationLink(user.getEmail(), link);
  }
}
