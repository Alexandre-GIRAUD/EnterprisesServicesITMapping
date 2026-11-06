package com.enterprise.itmapping.feature.integrations.github.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.integrations.WorkspaceCredentials;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class GitHubAccountServiceTest {

  private final WorkspaceRepository workspaces = mock(WorkspaceRepository.class);
  private final GitHubTokenClient tokens = mock(GitHubTokenClient.class);
  private final UUID workspaceId = UUID.randomUUID();
  private final WorkspaceEntity workspace = new WorkspaceEntity(workspaceId, "Acme");
  private GitHubAccountService service;

  @BeforeEach
  void setUp() {
    when(workspaces.findById(workspaceId)).thenReturn(Optional.of(workspace));
    service =
        new GitHubAccountService(
            new WorkspaceCredentials(
                workspaces, new JwtProperties("test-jwt-secret-at-least-32-bytes-long", 86_400_000)),
            tokens);
  }

  @Test
  void saveTokenStoresTheLoginOnTheWorkspaceAndKeepsTheTokenEncrypted() {
    when(tokens.identify("workspace-access-token"))
        .thenReturn(new GitHubIdentity("octocat", "workspace-access-token"));

    CurrentWorkspace.runAs(
        workspaceId,
        () -> {
          var status = service.saveToken("  workspace-access-token  ");

          assertThat(status.connected()).isTrue();
          assertThat(status.login()).isEqualTo("octocat");
          assertThat(service.accessToken()).isEqualTo("workspace-access-token");
        });
    assertThat(workspace.getGitHubToken()).isNotEqualTo("workspace-access-token");
  }

  @Test
  void saveTokenRejectsABlankToken() {
    CurrentWorkspace.runAs(
        workspaceId,
        () ->
            assertThatThrownBy(() -> service.saveToken("  "))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST));
    verify(tokens, never()).identify(any());
  }

  @Test
  void disconnectClearsTheWorkspaceConnection() {
    workspace.connectGitHub("octocat", "cipher");

    CurrentWorkspace.runAs(
        workspaceId,
        () -> {
          service.disconnect();

          assertThat(service.status().connected()).isFalse();
        });
    assertThat(workspace.getGitHubLogin()).isNull();
    assertThat(workspace.getGitHubToken()).isNull();
  }

  @Test
  void thereIsNoTokenOutsideAWorkspace() {
    assertThat(service.accessToken()).isEmpty();
  }
}
