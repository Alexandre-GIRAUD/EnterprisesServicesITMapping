package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Refuses to boot an open signup that would leak the server GitHub token or send dead links. */
@Component
public class SignupStartupGuard {

  public SignupStartupGuard(
      SignupProperties signup,
      GitHubIntegrationProperties github,
      @Value("${spring.mail.host:}") String smtpHost) {
    check(signup.enabled(), signup.publicUrl(), smtpHost, github.token());
  }

  static void check(
      boolean isSignupEnabled, String publicUrl, String smtpHost, String serverGitHubToken) {
    if (!isSignupEnabled) {
      return;
    }
    // Until each workspace brings its own GitHub credentials, the server token would read
    // repositories on behalf of every self-registered workspace.
    if (StringUtils.hasText(serverGitHubToken)) {
      throw new IllegalStateException(
          "APP_SIGNUP_ENABLED=true cannot run with GITHUB_TOKEN set: unset GITHUB_TOKEN.");
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
