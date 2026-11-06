package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceRepository;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** The secret each workspace's GitHub webhook deliveries are signed with, stored encrypted. */
@Service
public class WorkspaceWebhookSecrets {

  private static final int SECRET_BYTES = 32;
  private static final SecureRandom RANDOM = new SecureRandom();

  private final WorkspaceRepository workspaces;
  private final JwtProperties jwt;

  public WorkspaceWebhookSecrets(WorkspaceRepository workspaces, JwtProperties jwt) {
    this.workspaces = workspaces;
    this.jwt = jwt;
  }

  /** The current workspace's secret, created on first use. */
  @Transactional
  public String currentSecret() {
    WorkspaceEntity workspace = requireCurrentWorkspace();
    Optional<String> existing = decrypt(workspace);
    return existing.isPresent() ? existing.get() : replaceSecret(workspace);
  }

  /** A new secret for the current workspace; deliveries signed with the old one are refused. */
  @Transactional
  public String regenerate() {
    return replaceSecret(requireCurrentWorkspace());
  }

  /** The secret of {@code workspaceId}; empty for an unknown workspace or one without a secret. */
  @Transactional(readOnly = true)
  public Optional<String> secretFor(UUID workspaceId) {
    return workspaces.findById(workspaceId).flatMap(this::decrypt);
  }

  private String replaceSecret(WorkspaceEntity workspace) {
    requireEncryptionKey();
    byte[] bytes = new byte[SECRET_BYTES];
    RANDOM.nextBytes(bytes);
    String secret = HexFormat.of().formatHex(bytes);
    workspace.setGithubWebhookSecret(GitHubTokenCipher.encrypt(secret, jwt.secret()));
    return secret;
  }

  private Optional<String> decrypt(WorkspaceEntity workspace) {
    if (!StringUtils.hasText(workspace.getGithubWebhookSecret())
        || !StringUtils.hasText(jwt.secret())) {
      return Optional.empty();
    }
    try {
      return Optional.of(GitHubTokenCipher.decrypt(workspace.getGithubWebhookSecret(), jwt.secret()));
    } catch (IllegalStateException keyChanged) {
      return Optional.empty();
    }
  }

  private WorkspaceEntity requireCurrentWorkspace() {
    return workspaces.findById(CurrentWorkspace.requireId()).orElseThrow();
  }

  private void requireEncryptionKey() {
    if (!StringUtils.hasText(jwt.secret())) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "JWT_SECRET is required to store a webhook secret.");
    }
  }
}
