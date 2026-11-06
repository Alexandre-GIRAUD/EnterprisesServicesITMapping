package com.enterprise.itmapping.feature.integrations.github;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.integrations.github.application.GitHubAccountService;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

/** GitHub calls use the current workspace connection, never a server-wide token. */
class GitHubApiClientTokenTest {

  private final GitHubAccountService accounts = mock(GitHubAccountService.class);
  private final GitHubApiClient client =
      new GitHubApiClient(properties("example-ignored-server-token"), accounts);

  @Test
  void theWorkspaceConnectionTokenIsUsed() {
    when(accounts.accessToken()).thenReturn("workspace-token");

    assertThat(tokenInSomeWorkspace()).isEqualTo("workspace-token");
  }

  @Test
  void aWorkspaceWithoutConnectionHasNoToken() {
    when(accounts.accessToken()).thenReturn("");

    assertThat(tokenInSomeWorkspace()).isEmpty();
  }

  @Test
  void workOutsideAnyWorkspaceHasNoToken() {
    assertThat(client.token()).isEmpty();
  }

  private String tokenInSomeWorkspace() {
    AtomicReference<String> token = new AtomicReference<>();
    CurrentWorkspace.runAs(UUID.randomUUID(), () -> token.set(client.token()));
    return token.get();
  }

  private static GitHubIntegrationProperties properties(String token) {
    return new GitHubIntegrationProperties(
        token, "https://api.github.com", 100, "", "refs/heads/main", 80, 512);
  }
}
