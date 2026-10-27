package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Links one Flowra user to a GitHub account by a pasted token. The access token is encrypted with
 * the JWT secret: rotating {@code JWT_SECRET} makes stored connections unreadable, and the user
 * pastes the token again.
 */
@Service
public class GitHubAccountService {

  private final UserRepository users;
  private final GitHubTokenClient tokens;
  private final JwtProperties jwt;

  public GitHubAccountService(UserRepository users, GitHubTokenClient tokens, JwtProperties jwt) {
    this.users = users;
    this.tokens = tokens;
    this.jwt = jwt;
  }

  /** Stores a token the signed-in user pasted. The plaintext is not returned. */
  @Transactional
  public GitHubConnectionStatus saveToken(UserEntity user, String rawToken) {
    requireEncryptionKey();
    if (!StringUtils.hasText(rawToken)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A GitHub token is required.");
    }
    GitHubIdentity identity = tokens.identify(rawToken.trim());
    user.setGithubLogin(identity.login());
    user.setGithubAccessToken(GitHubTokenCipher.encrypt(identity.accessToken(), jwt.secret()));
    users.save(user);
    return status(user);
  }

  @Transactional
  public void disconnect(UserEntity user) {
    user.setGithubLogin(null);
    user.setGithubAccessToken(null);
    users.save(user);
  }

  public GitHubConnectionStatus status(UserEntity user) {
    boolean connected =
        StringUtils.hasText(user.getGithubLogin()) && StringUtils.hasText(user.getGithubAccessToken());
    return new GitHubConnectionStatus(connected, connected ? user.getGithubLogin() : null);
  }

  /** Decrypted token, or an empty string when this user has not connected or the key changed. */
  public String accessToken(UserEntity user) {
    if (user == null
        || !StringUtils.hasText(user.getGithubAccessToken())
        || !StringUtils.hasText(jwt.secret())) {
      return "";
    }
    try {
      return GitHubTokenCipher.decrypt(user.getGithubAccessToken(), jwt.secret());
    } catch (IllegalStateException ex) {
      return "";
    }
  }

  private void requireEncryptionKey() {
    if (!StringUtils.hasText(jwt.secret())) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "JWT_SECRET is required to store a GitHub connection.");
    }
  }
}
