package com.enterprise.itmapping.feature.integrations.github.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.changedetection.application.ChangeDetectionService;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubWebhookSignatureVerifier;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    controllers = GitHubWebhookController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class)
class GitHubWebhookControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean GitHubWebhookSignatureVerifier signatureVerifier;
  @MockBean GitHubIntegrationProperties properties;
  @MockBean ChangeDetectionService changeDetectionService;

  @Test
  void acceptsPushAfterSignatureCheck() throws Exception {
    when(properties.webhookSecret()).thenReturn("s3cret");
    UUID runId = UUID.randomUUID();
    when(changeDetectionService.ingestPushWebhook(any())).thenReturn(List.of(runId));
    byte[] body =
        "{\"ref\":\"refs/heads/main\",\"repository\":{\"full_name\":\"acme/demo\"}}"
            .getBytes(StandardCharsets.UTF_8);

    mockMvc
        .perform(
            post("/webhooks/github")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Hub-Signature-256", "sha256=abc")
                .header("X-GitHub-Event", "push")
                .content(body))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.accepted").value(true))
        .andExpect(jsonPath("$.runIds[0]").value(runId.toString()));

    verify(signatureVerifier).verify(eq("s3cret"), eq("sha256=abc"), any());
  }
}
