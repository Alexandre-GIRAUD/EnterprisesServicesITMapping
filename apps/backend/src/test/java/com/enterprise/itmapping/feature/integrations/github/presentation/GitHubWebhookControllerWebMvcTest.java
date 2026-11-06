package com.enterprise.itmapping.feature.integrations.github.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.changedetection.application.ChangeDetectionService;
import com.enterprise.itmapping.feature.history.application.PastSystemView;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubWebhookSignatureVerifier;
import com.enterprise.itmapping.feature.integrations.github.application.WorkspaceWebhookSecrets;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import com.enterprise.itmapping.feature.workspace.domain.Workspaces;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@WebMvcTest(
    controllers = GitHubWebhookController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class)
class GitHubWebhookControllerWebMvcTest {

  private static final byte[] PUSH =
      "{\"ref\":\"refs/heads/main\",\"repository\":{\"full_name\":\"acme/demo\"}}"
          .getBytes(StandardCharsets.UTF_8);

  /** The as-of filter is part of every MVC slice; the tests never read a past view. */
  @MockBean PastSystemView pastSystemView;

  @Autowired MockMvc mockMvc;

  @MockBean GitHubWebhookSignatureVerifier signatureVerifier;
  @MockBean GitHubIntegrationProperties properties;
  @MockBean ChangeDetectionService changeDetectionService;
  @MockBean WorkspaceWebhookSecrets webhookSecrets;

  @Test
  void aWorkspacePushIsCheckedWithThatWorkspaceSecretAndIngestedThere() throws Exception {
    UUID workspaceId = UUID.randomUUID();
    when(webhookSecrets.findSecretFor(workspaceId)).thenReturn(Optional.of("workspace-secret"));
    AtomicReference<Optional<UUID>> ingestedIn = recordIngestionWorkspace();

    push("/webhooks/github/" + workspaceId)
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.accepted").value(true));

    verify(signatureVerifier).verify(eq("workspace-secret"), eq("sha256=abc"), any());
    assertThat(ingestedIn.get()).contains(workspaceId);
  }

  @Test
  void anUnknownWorkspaceAnswersLikeABadSignature() throws Exception {
    when(webhookSecrets.findSecretFor(any())).thenReturn(Optional.empty());

    push("/webhooks/github/" + UUID.randomUUID()).andExpect(status().isUnauthorized());

    verify(changeDetectionService, never()).ingestPushWebhook(any());
  }

  @Test
  void theLegacyUrlServesTheDefaultWorkspaceWithTheGlobalSecret() throws Exception {
    when(properties.webhookSecret()).thenReturn("global-secret");
    AtomicReference<Optional<UUID>> ingestedIn = recordIngestionWorkspace();

    push("/webhooks/github").andExpect(status().isAccepted());

    verify(signatureVerifier).verify(eq("global-secret"), eq("sha256=abc"), any());
    assertThat(ingestedIn.get()).contains(Workspaces.DEFAULT_ID);
  }

  @Test
  void theLegacyUrlIsGoneWithoutTheGlobalSecret() throws Exception {
    when(properties.webhookSecret()).thenReturn("");

    push("/webhooks/github").andExpect(status().isNotFound());

    verify(changeDetectionService, never()).ingestPushWebhook(any());
  }

  private AtomicReference<Optional<UUID>> recordIngestionWorkspace() {
    AtomicReference<Optional<UUID>> ingestedIn = new AtomicReference<>(Optional.empty());
    when(changeDetectionService.ingestPushWebhook(any()))
        .thenAnswer(
            call -> {
              ingestedIn.set(CurrentWorkspace.find());
              return List.of(UUID.randomUUID());
            });
    return ingestedIn;
  }

  private ResultActions push(String path) throws Exception {
    return mockMvc.perform(
        post(path)
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Hub-Signature-256", "sha256=abc")
            .header("X-GitHub-Event", "push")
            .content(PUSH));
  }
}
