package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.signup.domain.TokenPurpose;
import java.time.Duration;
import org.springframework.web.util.HtmlUtils;

/** The English account emails: each says what the link does and how long it lasts. */
public final class AccountEmails {

  public static final Duration INVITATION_VALIDITY = Duration.ofDays(7);

  /** Below this, a lifetime reads in hours ("24 hours"); from it on, in days ("7 days"). */
  private static final Duration DAYS_THRESHOLD = Duration.ofHours(48);

  private static final String TEXT_LAYOUT =
      """
      %s

      %s:
      %s

      This link expires in %s. %s
      """;
  private static final String HTML_LAYOUT =
      """
      <p>%s</p>
      <p><a href="%s">%s</a></p>
      <p>Or paste this link into your browser:<br>%s</p>
      <p>This link expires in %s. %s</p>
      """;

  private AccountEmails() {}

  /** The wording of one email around its link. */
  private record Wording(String subject, String intro, String action, String footer) {}

  public static AccountEmail emailVerification(String link) {
    return compose(
        new Wording(
            "Confirm your email address",
            "Welcome to Flowra.",
            "Confirm your email address to open your workspace",
            "If you did not sign up, ignore this email."),
        link,
        TokenPurpose.VERIFY_EMAIL.validity());
  }

  public static AccountEmail passwordReset(String link) {
    return compose(
        new Wording(
            "Reset your Flowra password",
            "Someone asked to reset the password of your Flowra account.",
            "Choose a new password",
            "If it was not you, ignore this email: your password stays the same."),
        link,
        TokenPurpose.RESET_PASSWORD.validity());
  }

  public static AccountEmail invitation(String link, String workspaceName) {
    return compose(
        new Wording(
            "You are invited to " + workspaceName + " on Flowra",
            "You are invited to join the " + workspaceName + " workspace on Flowra.",
            "Accept the invitation and choose your password",
            "If you were not expecting it, ignore this email."),
        link,
        INVITATION_VALIDITY);
  }

  public static AccountEmail emailChange(String link) {
    return compose(
        new Wording(
            "Confirm your new email address",
            "You asked to use this address for your Flowra account.",
            "Confirm this email address",
            "If it was not you, ignore this email: nothing changes."),
        link,
        TokenPurpose.CHANGE_EMAIL.validity());
  }

  private static AccountEmail compose(Wording wording, String link, Duration validity) {
    String lifetime = describe(validity);
    String text =
        TEXT_LAYOUT.formatted(wording.intro(), wording.action(), link, lifetime, wording.footer());
    String html =
        HTML_LAYOUT.formatted(
            HtmlUtils.htmlEscape(wording.intro()),
            HtmlUtils.htmlEscape(link),
            HtmlUtils.htmlEscape(wording.action()),
            HtmlUtils.htmlEscape(link),
            lifetime,
            HtmlUtils.htmlEscape(wording.footer()));
    return new AccountEmail(wording.subject(), text, html);
  }

  static String describe(Duration validity) {
    if (validity.compareTo(DAYS_THRESHOLD) < 0) {
      long hours = validity.toHours();
      return hours + (hours == 1 ? " hour" : " hours");
    }
    long days = validity.toDays();
    return days + (days == 1 ? " day" : " days");
  }
}
