package com.enterprise.itmapping.feature.integrations.bitbucket.application;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubTokenCipher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Links one Flowra user to a Bitbucket Cloud connection. The access token is encrypted with the JWT
 * secret: rotating {@code JWT_SECRET} makes stored connections unreadable, and the user connects
 * again.
 */
@Service
public class BitbucketAccountService {

  private final UserRepository users;
  private final BitbucketTokenClient tokens;
  private final JwtProperties jwt;

  public BitbucketAccountService(UserRepository users, BitbucketTokenClient tokens, JwtProperties jwt) {
    this.users = users;
    this.tokens = tokens;
    this.jwt = jwt;
  }

  @Transactional
  public BitbucketConnectionStatus saveToken(UserEntity user, String rawToken) {
    requireEncryptionKey();
    if (!StringUtils.hasText(rawToken)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A Bitbucket token is required.");
    }
    BitbucketIdentity identity = tokens.identify(rawToken.trim());
    user.setBitbucketUsername(identity.username());
    user.setBitbucketAccessToken(GitHubTokenCipher.encrypt(identity.accessToken(), jwt.secret()));
    users.save(user);
    return status(user);
  }

  @Transactional
  public void disconnect(UserEntity user) {
    user.setBitbucketUsername(null);
    user.setBitbucketAccessToken(null);
    users.save(user);
  }

  public BitbucketConnectionStatus status(UserEntity user) {
    boolean connected =
        StringUtils.hasText(user.getBitbucketUsername())
            && StringUtils.hasText(user.getBitbucketAccessToken());
    return new BitbucketConnectionStatus(connected, connected ? user.getBitbucketUsername() : null);
  }

  /** Decrypted token, or an empty string when this user has not connected or the key changed. */
  public String accessToken(UserEntity user) {
    if (user == null
        || !StringUtils.hasText(user.getBitbucketAccessToken())
        || !StringUtils.hasText(jwt.secret())) {
      return "";
    }
    try {
      return GitHubTokenCipher.decrypt(user.getBitbucketAccessToken(), jwt.secret());
    } catch (IllegalStateException ex) {
      return "";
    }
  }

  private void requireEncryptionKey() {
    if (!StringUtils.hasText(jwt.secret())) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "JWT_SECRET is required to store a Bitbucket connection.");
    }
  }
}
