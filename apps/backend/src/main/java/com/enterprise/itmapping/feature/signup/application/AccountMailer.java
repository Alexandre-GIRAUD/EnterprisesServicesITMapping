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

/** Sends an account email, as plain text and HTML. */
@Component
public class AccountMailer {

  private static final boolean MULTIPART = true;

  // A provider: on-premise installs have no SMTP host, hence no JavaMailSender bean.
  private final ObjectProvider<JavaMailSender> mailSender;
  private final String from;

  public AccountMailer(
      ObjectProvider<JavaMailSender> mailSender,
      @Value("${app.signup.mail-from:Flowra <no-reply@localhost>}") String from) {
    this.mailSender = mailSender;
    this.from = from;
  }

  public void send(String to, AccountEmail email) {
    JavaMailSender sender = mailSender.getObject();
    MimeMessage message = sender.createMimeMessage();
    try {
      MimeMessageHelper helper =
          new MimeMessageHelper(message, MULTIPART, StandardCharsets.UTF_8.name());
      helper.setFrom(from);
      helper.setTo(to);
      helper.setSubject(email.subject());
      helper.setText(email.text(), email.html());
    } catch (MessagingException e) {
      throw new MailSendException(
          "Could not build the email \"" + email.subject() + "\" for " + to, e);
    }
    sender.send(message);
  }
}
