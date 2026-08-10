package com.enterprise.itmapping.feature.integrations.github.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class GitHubWebhookSignatureVerifierTest {

  private final GitHubWebhookSignatureVerifier verifier = new GitHubWebhookSignatureVerifier();

  @Test
  void acceptsValidSignature() {
    String secret = "test-secret";
    byte[] body = "{\"ref\":\"refs/heads/main\"}".getBytes(StandardCharsets.UTF_8);
    String sig = "sha256=" + GitHubWebhookSignatureVerifier.hmacSha256Hex(secret, body);
    verifier.verify(secret, sig, body);
  }

  @Test
  void rejectsInvalidSignature() {
    assertThatThrownBy(
            () ->
                verifier.verify(
                    "test-secret",
                    "sha256=deadbeef",
                    "{}".getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  @Test
  void rejectsMissingSecret() {
    assertThatThrownBy(() -> verifier.verify("", "sha256=abc", new byte[0]))
        .isInstanceOf(ResponseStatusException.class)
        .satisfies(
            ex ->
                assertThat(((ResponseStatusException) ex).getStatusCode())
                    .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
  }
}
