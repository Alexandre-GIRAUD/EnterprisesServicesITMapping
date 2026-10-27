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
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class GitHubAccountServiceTest {

  private final UserRepository users = mock(UserRepository.class);
  private final GitHubTokenClient tokens = mock(GitHubTokenClient.class);
  private final UserEntity user = new UserEntity();
  private GitHubAccountService service;

  @BeforeEach
  void setUp() {
    user.setId(UUID.randomUUID());
    user.setUsername("alex");
    when(users.save(any(UserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
    service =
        new GitHubAccountService(
            users, tokens, new JwtProperties("test-jwt-secret-at-least-32-bytes-long", 86_400_000));
  }

  @Test
  void saveTokenStoresTheLoginAndKeepsTheTokenEncrypted() {
    when(tokens.identify("user-access-token")).thenReturn(new GitHubIdentity("octocat", "user-access-token"));

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
    verify(tokens, never()).identify(any());
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
}
