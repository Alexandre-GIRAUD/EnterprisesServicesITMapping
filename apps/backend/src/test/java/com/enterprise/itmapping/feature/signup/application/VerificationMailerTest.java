package com.enterprise.itmapping.feature.signup.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;

class VerificationMailerTest {

  @Test
  @SuppressWarnings("unchecked")
  void sendsAnEnglishEmailCarryingTheLink() throws Exception {
    JavaMailSender sender = mock(JavaMailSender.class);
    when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
    ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
    when(provider.getObject()).thenReturn(sender);
    VerificationMailer mailer = new VerificationMailer(provider, "no-reply@example.test");

    mailer.sendVerificationLink("ada@example.test", "https://app.example.test/verify-email?token=abc");

    ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
    verify(sender).send(sent.capture());
    MimeMessage message = sent.getValue();
    assertThat(message.getAllRecipients()[0].toString()).isEqualTo("ada@example.test");
    assertThat(message.getSubject()).isEqualTo("Confirm your email address");
    ByteArrayOutputStream raw = new ByteArrayOutputStream();
    message.writeTo(raw);
    assertThat(raw.toString(StandardCharsets.UTF_8))
        .contains("https://app.example.test/verify-email?token=abc")
        .contains("This link expires in 24 hours");
  }
}
