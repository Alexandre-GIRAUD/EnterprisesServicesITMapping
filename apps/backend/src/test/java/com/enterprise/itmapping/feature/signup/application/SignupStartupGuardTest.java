package com.enterprise.itmapping.feature.signup.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class SignupStartupGuardTest {

  private static final String PUBLIC_URL = "https://app.example.com";
  private static final String SMTP_HOST = "smtp.example.com";

  @Test
  void disabledSignupNeedsNothing() {
    assertThatCode(() -> SignupStartupGuard.check(false, "", ""))
        .doesNotThrowAnyException();
  }

  @Test
  void enabledSignupWithEverythingConfiguredStarts() {
    assertThatCode(() -> SignupStartupGuard.check(true, PUBLIC_URL, SMTP_HOST))
        .doesNotThrowAnyException();
  }

  @Test
  void enabledSignupNeedsThePublicUrl() {
    assertThatThrownBy(() -> SignupStartupGuard.check(true, " ", SMTP_HOST))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("APP_PUBLIC_URL");
  }

  @Test
  void enabledSignupNeedsAnSmtpHost() {
    assertThatThrownBy(() -> SignupStartupGuard.check(true, PUBLIC_URL, ""))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("SMTP_HOST");
  }
}
