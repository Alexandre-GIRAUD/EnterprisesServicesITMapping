package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.signup.domain.TokenPurpose;
import org.springframework.stereotype.Component;

/** Issues a fresh token for a pending account and mails the link that redeems it. */
@Component
public class VerificationLinks {

  private static final String VERIFY_PATH = "/verify-email";

  private final AccountTokens tokens;
  private final AccountMailer mailer;
  private final AccountLinks accountLinks;

  public VerificationLinks(AccountTokens tokens, AccountMailer mailer, AccountLinks accountLinks) {
    this.tokens = tokens;
    this.mailer = mailer;
    this.accountLinks = accountLinks;
  }

  public void send(UserEntity user) {
    String token = tokens.issue(user, TokenPurpose.VERIFY_EMAIL);
    mailer.send(
        user.getEmail(), AccountEmails.emailVerification(accountLinks.build(VERIFY_PATH, token)));
  }
}
