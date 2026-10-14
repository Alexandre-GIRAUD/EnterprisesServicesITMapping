package com.enterprise.itmapping.feature.integrations.github;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubAccountService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;

class GitHubApiClientTokenTest {

  private final UserRepository users = mock(UserRepository.class);
  private final GitHubAccountService accounts = mock(GitHubAccountService.class);
  private final GitHubApiClient client =
      new GitHubApiClient(properties("server-token"), accounts, users);

  @AfterEach
  void clearSecurity() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void serverTokenIsUsedWhenNobodyIsSignedIn() {
    assertThat(client.token()).isEqualTo("server-token");
  }

  @Test
  void connectedUserTokenReplacesTheServerToken() {
    UserEntity user = new UserEntity();
    user.setUsername("alex");
    when(users.findByUsernameIgnoreCase("alex")).thenReturn(Optional.of(user));
    when(accounts.accessToken(user)).thenReturn("user-token");
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken("alex", "n/a", List.of()));

    assertThat(client.token()).isEqualTo("user-token");
  }

  @Test
  void signedInUserWithoutAConnectionUsesTheServerToken() {
    UserEntity user = new UserEntity();
    user.setUsername("alex");
    when(users.findByUsernameIgnoreCase("alex")).thenReturn(Optional.of(user));
    when(accounts.accessToken(user)).thenReturn("");
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken("alex", "n/a", List.of()));

    assertThat(client.token()).isEqualTo("server-token");
  }

  @Test
  void anonymousRequestUsesTheServerToken() {
    SecurityContextHolder.getContext()
        .setAuthentication(
            new AnonymousAuthenticationToken(
                "key", "anonymousUser", AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")));

    assertThat(client.token()).isEqualTo("server-token");
  }

  private static GitHubIntegrationProperties properties(String token) {
    return new GitHubIntegrationProperties(
        token,
        "https://api.github.com",
        100,
        "",
        "refs/heads/main",
        80,
        512,
        "",
        "",
        "http://localhost:8081/api/integrations/github/callback",
        "http://localhost:3000/map/import-github");
  }
}
