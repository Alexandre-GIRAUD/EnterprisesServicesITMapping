package com.enterprise.itmapping.feature.integrations.github.presentation;

import com.enterprise.itmapping.feature.integrations.github.application.WorkspaceWebhookSecrets;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** What an admin pastes into GitHub's webhook form for this workspace. */
@RestController
@RequestMapping("/integrations/github/webhook")
@PreAuthorize("hasRole('ADMIN')")
public class GitHubWebhookSettingsController {

  private final WorkspaceWebhookSecrets webhookSecrets;
  private final String contextPath;

  public GitHubWebhookSettingsController(
      WorkspaceWebhookSecrets webhookSecrets,
      @Value("${server.servlet.context-path:}") String contextPath) {
    this.webhookSecrets = webhookSecrets;
    this.contextPath = contextPath;
  }

  @GetMapping
  public WebhookSettings getWebhookSettings() {
    return new WebhookSettings(workspaceWebhookPath(), webhookSecrets.currentSecret());
  }

  @PostMapping("/secret")
  public WebhookSettings regenerateSecret() {
    return new WebhookSettings(workspaceWebhookPath(), webhookSecrets.regenerate());
  }

  private String workspaceWebhookPath() {
    return contextPath + GitHubWebhookController.WEBHOOK_PATH + "/" + CurrentWorkspace.requireId();
  }

  /** {@code path} is relative to the public origin the browser knows. */
  public record WebhookSettings(String path, String secret) {}
}
