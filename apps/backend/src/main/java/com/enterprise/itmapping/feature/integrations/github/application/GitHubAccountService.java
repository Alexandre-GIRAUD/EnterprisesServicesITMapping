package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Links one Flowra user to a GitHub account. The access token is encrypted with the JWT secret:
 * rotating {@code JWT_SECRET} makes stored connections unreadable, and the user connects again.
 */
@Service
public class GitHubAccountService {

  private static final Duration STATE_TTL = Duration.ofMinutes(10);
  private static final String AUTHORIZE_URL = "https://github.com/login/oauth/authorize";

  private final UserRepository users;
  private final GitHubIntegrationProperties properties;
  private final GitHubOAuthClient oauth;
  private final JwtProperties jwt;

  public GitHubAccountService(
      UserRepository users,
      GitHubIntegrationProperties properties,
      GitHubOAuthClient oauth,
      JwtProperties jwt) {
    this.users = users;
    this.properties = properties;
    this.oauth = oauth;
    this.jwt = jwt;
  }

  @Transactional
  public String begin(UserEntity user) {
    requireOAuthConfigured();
    String state = newState();
    user.setGithubOauthState(state);
    user.setGithubOauthStateExpires(Instant.now().plus(STATE_TTL));
    users.save(user);
    return AUTHORIZE_URL
        + "?client_id="
        + url(properties.clientId())
        + "&redirect_uri="
        + url(properties.oauthRedirectUri())
        + "&scope=repo%20read:user"
        + "&state="
        + url(state);
  }

  @Transactional
  public void finish(String state, String code) {
    requireOAuthConfigured();
    requireEncryptionKey();
    if (!StringUtils.hasText(state) || !StringUtils.hasText(code)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "GitHub authorization is incomplete.");
    }
    UserEntity user =
        users
            .findByGithubOauthState(state.trim())
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "GitHub connection request was not found."));
    Instant expires = user.getGithubOauthStateExpires();
    if (expires == null || expires.isBefore(Instant.now())) {
      clearState(user);
      users.save(user);
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "GitHub connection request expired. Start again.");
    }
    GitHubIdentity identity = oauth.exchange(code.trim());
    user.setGithubLogin(identity.login());
    user.setGithubAccessToken(GitHubTokenCipher.encrypt(identity.accessToken(), jwt.secret()));
    clearState(user);
    users.save(user);
  }

  /** Stores a token the signed-in user pasted. The plaintext is not returned. */
  @Transactional
  public GitHubConnectionStatus saveToken(UserEntity user, String rawToken) {
    requireEncryptionKey();
    if (!StringUtils.hasText(rawToken)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A GitHub token is required.");
    }
    GitHubIdentity identity = oauth.identify(rawToken.trim());
    user.setGithubLogin(identity.login());
    user.setGithubAccessToken(GitHubTokenCipher.encrypt(identity.accessToken(), jwt.secret()));
    clearState(user);
    users.save(user);
    return status(user);
  }

  @Transactional
  public void disconnect(UserEntity user) {
    user.setGithubLogin(null);
    user.setGithubAccessToken(null);
    clearState(user);
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

  public String returnUrl(String flag) {
    String base = properties.oauthReturnUrl();
    String joiner = base.contains("?") ? "&" : "?";
    return base + joiner + "github=" + flag;
  }

  private void requireOAuthConfigured() {
    if (!StringUtils.hasText(properties.clientId()) || !StringUtils.hasText(properties.clientSecret())) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.");
    }
  }

  private void requireEncryptionKey() {
    if (!StringUtils.hasText(jwt.secret())) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "JWT_SECRET is required to store a GitHub connection.");
    }
  }

  private static void clearState(UserEntity user) {
    user.setGithubOauthState(null);
    user.setGithubOauthStateExpires(null);
  }

  private static String newState() {
    byte[] bytes = new byte[32];
    new SecureRandom().nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private static String url(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
