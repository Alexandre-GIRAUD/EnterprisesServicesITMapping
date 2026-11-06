package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.signup.domain.TokenPurpose;
import com.enterprise.itmapping.feature.signup.infrastructure.persistence.AccountTokenEntity;
import com.enterprise.itmapping.feature.signup.infrastructure.persistence.AccountTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Issues and redeems single-use email verification tokens. */
@Component
public class AccountTokens {

  private static final int TOKEN_BYTES = 32;
  private static final String HASH_ALGORITHM = "SHA-256";

  private final AccountTokenRepository repository;
  private final Clock clock;
  private static final SecureRandom RANDOM = new SecureRandom();

  public AccountTokens(AccountTokenRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  /** @return the raw token for the link; only its hash is kept */
  public String issue(UserEntity user, TokenPurpose purpose) {
    return issue(user, purpose, null);
  }

  /** As {@link #issue(UserEntity, TokenPurpose)}, carrying the address an email change confirms. */
  public String issue(UserEntity user, TokenPurpose purpose, String newEmail) {
    String token = newToken();
    repository.save(new AccountTokenEntity(user, purpose, newEmail, hash(token), clock.instant()));
    return token;
  }

  /**
   * The token, once: it is spent. Empty when unknown, used, expired or issued for another purpose.
   * Spending is a single conditional update, so two simultaneous clicks cannot both succeed.
   */
  public Optional<AccountTokenEntity> redeem(String token, TokenPurpose purpose) {
    String tokenHash = hash(token);
    if (repository.spendIfUsable(tokenHash, purpose, clock.instant()) == 0) {
      return Optional.empty();
    }
    return repository.findByTokenHash(tokenHash);
  }

  /** A random, URL-safe token for an emailed link. */
  public static String newToken() {
    byte[] bytes = new byte[TOKEN_BYTES];
    RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  public static String hash(String token) {
    try {
      MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
      return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is required by every Java runtime.", e);
    }
  }
}
