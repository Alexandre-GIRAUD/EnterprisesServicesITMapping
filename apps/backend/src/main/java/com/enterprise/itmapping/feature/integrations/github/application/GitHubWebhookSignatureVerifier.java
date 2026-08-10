package com.enterprise.itmapping.feature.integrations.github.application;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Verifies GitHub webhook {@code X-Hub-Signature-256} (HMAC-SHA256 of raw body). */
@Component
public class GitHubWebhookSignatureVerifier {

  public void verify(String webhookSecret, String signatureHeader, byte[] rawBody) {
    if (!StringUtils.hasText(webhookSecret)) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "GITHUB_WEBHOOK_SECRET is not configured.");
    }
    if (!StringUtils.hasText(signatureHeader) || !signatureHeader.startsWith("sha256=")) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing webhook signature.");
    }
    String expectedHex = hmacSha256Hex(webhookSecret.trim(), rawBody);
    String provided = signatureHeader.substring("sha256=".length()).trim();
    if (!MessageDigest.isEqual(
        expectedHex.getBytes(StandardCharsets.UTF_8), provided.getBytes(StandardCharsets.UTF_8))) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook signature.");
    }
  }

  static String hmacSha256Hex(String secret, byte[] body) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] digest = mac.doFinal(body != null ? body : new byte[0]);
      StringBuilder sb = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        sb.append(String.format("%02x", b));
      }
      return sb.toString();
    } catch (Exception e) {
      throw new IllegalStateException("Unable to compute webhook HMAC", e);
    }
  }
}
