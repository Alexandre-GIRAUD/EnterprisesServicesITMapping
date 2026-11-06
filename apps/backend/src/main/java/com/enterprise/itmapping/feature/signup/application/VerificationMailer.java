package com.enterprise.itmapping.feature.signup.application;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/** Sends the English verification email, as plain text and HTML. */
@Component
public class VerificationMailer {

  private static final String SUBJECT = "Confirm your email address";
  private static final String TEXT_BODY =
      """
      Welcome to Flowra.

      Confirm your email address to open your workspace:
      %s

      This link expires in %d hours. If you did not sign up, ignore this email.
      """;
  private static final String HTML_BODY =
      """
      <p>Welcome to Flowra.</p>
      <p><a href="%1$s">Confirm your email address</a> to open your workspace.</p>
      <p>Or paste this link into your browser:<br>%1$s</p>
      <p>This link expires in %2$d hours. If you did not sign up, ignore this email.</p>
      """;

  private static final boolean MULTIPART = true;

  // A provider: on-premise installs have no SMTP host, hence no JavaMailSender bean.
  private final ObjectProvider<JavaMailSender> mailSender;
  private final String from;

  public VerificationMailer(
      ObjectProvider<JavaMailSender> mailSender,
      @Value("${app.signup.mail-from:Flowra <no-reply@localhost>}") String from) {
    this.mailSender = mailSender;
    this.from = from;
  }

  public void sendVerificationLink(String email, String link) {
    JavaMailSender sender = mailSender.getObject();
    MimeMessage message = sender.createMimeMessage();
    try {
      MimeMessageHelper helper =
          new MimeMessageHelper(message, MULTIPART, StandardCharsets.UTF_8.name());
      helper.setFrom(from);
      helper.setTo(email);
      helper.setSubject(SUBJECT);
      long validHours = VerificationTokens.VALIDITY.toHours();
      helper.setText(
          TEXT_BODY.formatted(link, validHours),
          HTML_BODY.formatted(HtmlUtils.htmlEscape(link), validHours));
    } catch (MessagingException e) {
      throw new MailSendException("Could not build the verification email for " + email, e);
    }
    sender.send(message);
  }
}
