package com.enterprise.itmapping.feature.integrations.github.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class GitHubReposServiceTest {

  @Test
  void withoutAWorkspaceConnectionItSaysWhoConnectsGitHub() {
    GitHubApiClient apiClient = mock(GitHubApiClient.class);
    when(apiClient.hasToken()).thenReturn(false);
    GitHubReposService service =
        new GitHubReposService(
            apiClient,
            new GitHubIntegrationProperties(
                "", "https://api.github.com", 100, "", "refs/heads/main", 80, 512));

    assertThatThrownBy(service::listUserRepos)
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("This workspace has no GitHub connection.")
        .hasMessageContaining("An admin connects GitHub in Settings.");
  }
}
