package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceRepository;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** The workspace GitHub connection: one token per workspace, pasted by an admin. */
@Service
public class GitHubAccountService {

  private final WorkspaceRepository workspaces;
  private final GitHubTokenClient tokens;
  private final JwtProperties jwt;

  public GitHubAccountService(
      WorkspaceRepository workspaces, GitHubTokenClient tokens, JwtProperties jwt) {
    this.workspaces = workspaces;
    this.tokens = tokens;
    this.jwt = jwt;
  }

  /** Stores the token for the current workspace. The plaintext is not returned. */
  @Transactional
  public GitHubConnectionStatus saveToken(String rawToken) {
    requireEncryptionKey();
    if (!StringUtils.hasText(rawToken)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A GitHub token is required.");
    }
    GitHubIdentity identity = tokens.identify(rawToken.trim());
    WorkspaceEntity workspace = requireCurrentWorkspace();
    workspace.connectGitHub(
        identity.login(), GitHubTokenCipher.encrypt(identity.accessToken(), jwt.secret()));
    return status(workspace);
  }

  @Transactional
  public void disconnect() {
    requireCurrentWorkspace().connectGitHub(null, null);
  }

  @Transactional(readOnly = true)
  public GitHubConnectionStatus status() {
    return status(requireCurrentWorkspace());
  }

  /** Decrypted workspace token; empty outside a workspace, when not connected or the key changed. */
  @Transactional(readOnly = true)
  public String accessToken() {
    return currentWorkspace()
        .map(WorkspaceEntity::getGithubToken)
        .filter(StringUtils::hasText)
        .filter(ignored -> StringUtils.hasText(jwt.secret()))
        .map(this::decryptOrEmpty)
        .orElse("");
  }

  private String decryptOrEmpty(String cipherText) {
    try {
      return GitHubTokenCipher.decrypt(cipherText, jwt.secret());
    } catch (IllegalStateException ex) {
      return "";
    }
  }

  private static GitHubConnectionStatus status(WorkspaceEntity workspace) {
    boolean isConnected =
        StringUtils.hasText(workspace.getGithubLogin())
            && StringUtils.hasText(workspace.getGithubToken());
    return new GitHubConnectionStatus(isConnected, isConnected ? workspace.getGithubLogin() : null);
  }

  private Optional<WorkspaceEntity> currentWorkspace() {
    return CurrentWorkspace.find().flatMap(workspaces::findById);
  }

  private WorkspaceEntity requireCurrentWorkspace() {
    return workspaces.findById(CurrentWorkspace.requireId()).orElseThrow();
  }

  private void requireEncryptionKey() {
    if (!StringUtils.hasText(jwt.secret())) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "JWT_SECRET is required to store a GitHub connection.");
    }
  }
}
