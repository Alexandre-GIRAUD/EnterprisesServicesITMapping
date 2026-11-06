package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.WorkspaceCredentials;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** The workspace GitHub connection: one token per workspace, pasted by an admin. */
@Service
public class GitHubAccountService {

  private final WorkspaceCredentials credentials;
  private final GitHubTokenClient tokens;

  public GitHubAccountService(WorkspaceCredentials credentials, GitHubTokenClient tokens) {
    this.credentials = credentials;
    this.tokens = tokens;
  }

  /** Stores the token for the current workspace. The plaintext is not returned. */
  @Transactional
  public GitHubConnectionStatus saveToken(String rawToken) {
    if (!StringUtils.hasText(rawToken)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A GitHub token is required.");
    }
    GitHubIdentity identity = tokens.identify(rawToken.trim());
    WorkspaceEntity workspace = credentials.requireCurrentWorkspace();
    workspace.connectGitHub(identity.login(), credentials.encrypt(identity.accessToken()));
    return status(workspace);
  }

  @Transactional
  public void disconnect() {
    credentials.requireCurrentWorkspace().disconnectGitHub();
  }

  @Transactional(readOnly = true)
  public GitHubConnectionStatus status() {
    return status(credentials.requireCurrentWorkspace());
  }

  /** Decrypted workspace token; empty outside a workspace, when not connected or the key changed. */
  @Transactional(readOnly = true)
  public String accessToken() {
    return credentials
        .findCurrentWorkspace()
        .flatMap(workspace -> credentials.decrypt(workspace.getGitHubToken()))
        .orElse("");
  }

  private static GitHubConnectionStatus status(WorkspaceEntity workspace) {
    boolean isConnected =
        StringUtils.hasText(workspace.getGitHubLogin())
            && StringUtils.hasText(workspace.getGitHubToken());
    return new GitHubConnectionStatus(isConnected, isConnected ? workspace.getGitHubLogin() : null);
  }
}
