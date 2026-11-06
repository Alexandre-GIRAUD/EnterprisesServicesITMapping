package com.enterprise.itmapping.feature.signup.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Refuses to boot an open signup that could not send its verification links. */
@Component
public class SignupStartupGuard {

  public SignupStartupGuard(
      SignupProperties signup, @Value("${spring.mail.host:}") String smtpHost) {
    check(signup.enabled(), signup.publicUrl(), smtpHost);
  }

  static void check(boolean isSignupEnabled, String publicUrl, String smtpHost) {
    if (!isSignupEnabled) {
      return;
    }
    if (!StringUtils.hasText(publicUrl)) {
      throw new IllegalStateException(
          "APP_SIGNUP_ENABLED=true needs APP_PUBLIC_URL for verification links.");
    }
    if (!StringUtils.hasText(smtpHost)) {
      throw new IllegalStateException(
          "APP_SIGNUP_ENABLED=true needs SMTP_HOST to send verification emails.");
    }
  }
}
