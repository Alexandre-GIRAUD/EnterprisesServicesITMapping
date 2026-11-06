package com.enterprise.itmapping.feature.integrations.bitbucket.application;

import com.enterprise.itmapping.feature.integrations.WorkspaceCredentials;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** The workspace Bitbucket connection: one token per workspace, pasted by an admin. */
@Service
public class BitbucketAccountService {

  private final WorkspaceCredentials credentials;
  private final BitbucketTokenClient tokens;

  public BitbucketAccountService(WorkspaceCredentials credentials, BitbucketTokenClient tokens) {
    this.credentials = credentials;
    this.tokens = tokens;
  }

  /** Stores the token for the current workspace. The plaintext is not returned. */
  @Transactional
  public BitbucketConnectionStatus saveToken(String rawToken) {
    if (!StringUtils.hasText(rawToken)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A Bitbucket token is required.");
    }
    BitbucketIdentity identity = tokens.identify(rawToken.trim());
    WorkspaceEntity workspace = credentials.requireCurrentWorkspace();
    workspace.connectBitbucket(identity.username(), credentials.encrypt(identity.accessToken()));
    return status(workspace);
  }

  @Transactional
  public void disconnect() {
    credentials.requireCurrentWorkspace().disconnectBitbucket();
  }

  @Transactional(readOnly = true)
  public BitbucketConnectionStatus status() {
    return status(credentials.requireCurrentWorkspace());
  }

  /** Decrypted workspace token; empty outside a workspace, when not connected or the key changed. */
  @Transactional(readOnly = true)
  public String accessToken() {
    return credentials
        .findCurrentWorkspace()
        .flatMap(workspace -> credentials.decrypt(workspace.getBitbucketToken()))
        .orElse("");
  }

  private static BitbucketConnectionStatus status(WorkspaceEntity workspace) {
    boolean isConnected =
        StringUtils.hasText(workspace.getBitbucketUsername())
            && StringUtils.hasText(workspace.getBitbucketToken());
    return new BitbucketConnectionStatus(isConnected, isConnected ? workspace.getBitbucketUsername() : null);
  }
}
