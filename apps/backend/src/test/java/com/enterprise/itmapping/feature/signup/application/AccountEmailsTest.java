package com.enterprise.itmapping.feature.signup.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Every account email is in English, carries its link and says how long the link lasts. */
class AccountEmailsTest {

  private static final String LINK = "https://app.example.test/some-page?token=abc";

  @Test
  void emailVerification() {
    AccountEmail email = AccountEmails.emailVerification(LINK);

    assertThat(email.subject()).isEqualTo("Confirm your email address");
    assertThat(email.text()).contains(LINK).contains("This link expires in 24 hours.");
    assertThat(email.html()).contains(LINK);
  }

  @Test
  void passwordReset() {
    AccountEmail email = AccountEmails.passwordReset(LINK);

    assertThat(email.subject()).isEqualTo("Reset your Flowra password");
    assertThat(email.text()).contains(LINK).contains("This link expires in 1 hour.");
  }

  @Test
  void invitationNamesTheWorkspace() {
    AccountEmail email = AccountEmails.invitation(LINK, "Acme <Bank>");

    assertThat(email.subject()).isEqualTo("You are invited to Acme <Bank> on Flowra");
    assertThat(email.text()).contains(LINK).contains("This link expires in 7 days.");
    assertThat(email.html()).contains("Acme &lt;Bank&gt;").doesNotContain("Acme <Bank>");
  }

  @Test
  void emailChange() {
    AccountEmail email = AccountEmails.emailChange(LINK);

    assertThat(email.subject()).isEqualTo("Confirm your new email address");
    assertThat(email.text()).contains(LINK).contains("This link expires in 24 hours.");
  }
}
