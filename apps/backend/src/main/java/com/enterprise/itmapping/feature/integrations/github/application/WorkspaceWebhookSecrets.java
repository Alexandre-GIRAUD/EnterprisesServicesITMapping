package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.WorkspaceCredentials;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The secret each workspace's GitHub webhook deliveries are signed with, stored encrypted. */
@Service
public class WorkspaceWebhookSecrets {

  private static final int SECRET_BYTES = 32;
  private static final SecureRandom RANDOM = new SecureRandom();

  private final WorkspaceCredentials credentials;

  public WorkspaceWebhookSecrets(WorkspaceCredentials credentials) {
    this.credentials = credentials;
  }

  /** The current workspace's secret, created on first use. */
  @Transactional
  public String getOrCreateCurrentSecret() {
    WorkspaceEntity workspace = credentials.requireCurrentWorkspace();
    return credentials
        .decrypt(workspace.getGitHubWebhookSecret())
        .orElseGet(() -> replaceSecret(workspace));
  }

  /** A new secret for the current workspace; deliveries signed with the old one are refused. */
  @Transactional
  public String regenerate() {
    return replaceSecret(credentials.requireCurrentWorkspace());
  }

  /** The secret of {@code workspaceId}; empty for an unknown workspace or one without a secret. */
  @Transactional(readOnly = true)
  public Optional<String> findSecretFor(UUID workspaceId) {
    return credentials
        .findWorkspace(workspaceId)
        .flatMap(workspace -> credentials.decrypt(workspace.getGitHubWebhookSecret()));
  }

  private String replaceSecret(WorkspaceEntity workspace) {
    byte[] bytes = new byte[SECRET_BYTES];
    RANDOM.nextBytes(bytes);
    String secret = HexFormat.of().formatHex(bytes);
    workspace.setGitHubWebhookSecret(credentials.encrypt(secret));
    return secret;
  }
}
