package com.enterprise.itmapping.feature.integrations;

import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Credentials stored on a workspace (Git tokens, webhook secret), encrypted with a key derived
 * from JWT_SECRET. Changing that secret makes them unreadable: they read as absent.
 */
@Component
public class WorkspaceCredentials {

  private final WorkspaceRepository workspaces;
  private final JwtProperties jwt;

  public WorkspaceCredentials(WorkspaceRepository workspaces, JwtProperties jwt) {
    this.workspaces = workspaces;
    this.jwt = jwt;
  }

  public Optional<WorkspaceEntity> findCurrentWorkspace() {
    return CurrentWorkspace.find().flatMap(workspaces::findById);
  }

  public Optional<WorkspaceEntity> findWorkspace(UUID workspaceId) {
    return workspaces.findById(workspaceId);
  }

  public WorkspaceEntity requireCurrentWorkspace() {
    return findCurrentWorkspace()
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Sign in to a workspace to manage its connections."));
  }

  public String encrypt(String plain) {
    if (!StringUtils.hasText(jwt.secret())) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "JWT_SECRET is required to store workspace credentials.");
    }
    return CredentialCipher.encrypt(plain, jwt.secret());
  }

  /** Empty when nothing is stored, no key is set or the key changed since encryption. */
  public Optional<String> decrypt(String cipherText) {
    boolean isReadable = StringUtils.hasText(cipherText) && StringUtils.hasText(jwt.secret());
    if (!isReadable) {
      return Optional.empty();
    }
    try {
      return Optional.of(CredentialCipher.decrypt(cipherText, jwt.secret()));
    } catch (IllegalStateException keyChanged) {
      return Optional.empty();
    }
  }
}
