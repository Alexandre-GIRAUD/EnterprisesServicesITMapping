package com.enterprise.itmapping.feature.integrations.github.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class GitHubAccountServiceTest {

  private final UserRepository users = mock(UserRepository.class);
  private final GitHubOAuthClient oauth = mock(GitHubOAuthClient.class);
  private final UserEntity user = new UserEntity();
  private GitHubAccountService service;

  @BeforeEach
  void setUp() {
    user.setId(UUID.randomUUID());
    user.setUsername("alex");
    when(users.save(any(UserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
    service = serviceWith("client-id", "client-secret");
  }

  @Test
  void beginReturnsAnAuthorizeUrlBoundToThatUser() {
    String url = service.begin(user);

    assertThat(url).contains("client_id=client-id");
    assertThat(url).contains("scope=repo%20read:user");
    assertThat(user.getGithubOauthState()).isNotBlank();
    assertThat(url).contains("state=" + user.getGithubOauthState());
    assertThat(user.getGithubOauthStateExpires()).isAfter(Instant.now());
  }

  @Test
  void beginWithoutAClientIdIsUnavailable() {
    GitHubAccountService unconfigured = serviceWith("", "");

    assertThatThrownBy(() -> unconfigured.begin(user))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
  }

  @Test
  void finishStoresTheLoginAndKeepsTheTokenEncrypted() {
    user.setGithubOauthState("state-1");
    user.setGithubOauthStateExpires(Instant.now().plusSeconds(60));
    when(users.findByGithubOauthState("state-1")).thenReturn(Optional.of(user));
    when(oauth.exchange("code-1")).thenReturn(new GitHubIdentity("octocat", "user-access-token"));

    service.finish("state-1", "code-1");

    assertThat(user.getGithubLogin()).isEqualTo("octocat");
    assertThat(user.getGithubAccessToken()).isNotEqualTo("user-access-token");
    assertThat(user.getGithubOauthState()).isNull();
    assertThat(service.accessToken(user)).isEqualTo("user-access-token");
    assertThat(service.status(user).connected()).isTrue();
    assertThat(service.status(user).login()).isEqualTo("octocat");
  }

  @Test
  void finishRejectsAnExpiredState() {
    user.setGithubOauthState("state-1");
    user.setGithubOauthStateExpires(Instant.now().minusSeconds(5));
    when(users.findByGithubOauthState("state-1")).thenReturn(Optional.of(user));

    assertThatThrownBy(() -> service.finish("state-1", "code-1"))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.BAD_REQUEST);
    verify(oauth, never()).exchange(any());
    assertThat(user.getGithubLogin()).isNull();
  }

  @Test
  void saveTokenStoresTheLoginAndKeepsTheTokenEncrypted() {
    when(oauth.identify("user-access-token")).thenReturn(new GitHubIdentity("octocat", "user-access-token"));

    var status = service.saveToken(user, "  user-access-token  ");

    assertThat(status.connected()).isTrue();
    assertThat(status.login()).isEqualTo("octocat");
    assertThat(user.getGithubAccessToken()).isNotEqualTo("user-access-token");
    assertThat(service.accessToken(user)).isEqualTo("user-access-token");
  }

  @Test
  void saveTokenRejectsABlankToken() {
    assertThatThrownBy(() -> service.saveToken(user, "  "))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.BAD_REQUEST);
    verify(oauth, never()).identify(any());
  }

  @Test
  void disconnectClearsTheStoredAccount() {
    user.setGithubLogin("octocat");
    user.setGithubAccessToken("cipher");

    service.disconnect(user);

    assertThat(user.getGithubLogin()).isNull();
    assertThat(user.getGithubAccessToken()).isNull();
    assertThat(service.status(user).connected()).isFalse();
  }

  private GitHubAccountService serviceWith(String clientId, String clientSecret) {
    GitHubIntegrationProperties properties =
        new GitHubIntegrationProperties(
            "server-token",
            "https://api.github.com",
            100,
            "",
            "refs/heads/main",
            80,
            512,
            clientId,
            clientSecret,
            "http://localhost:8081/api/integrations/github/callback",
            "http://localhost:3000/map/import-github");
    return new GitHubAccountService(
        users, properties, oauth, new JwtProperties("test-jwt-secret-at-least-32-bytes-long", 86_400_000));
  }
}
