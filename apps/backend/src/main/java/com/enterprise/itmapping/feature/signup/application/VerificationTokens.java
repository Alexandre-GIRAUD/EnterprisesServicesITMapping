package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.signup.infrastructure.persistence.EmailVerificationTokenEntity;
import com.enterprise.itmapping.feature.signup.infrastructure.persistence.EmailVerificationTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Issues and redeems single-use email verification tokens. */
@Component
public class VerificationTokens {

  private static final int TOKEN_BYTES = 32;
  private static final String HASH_ALGORITHM = "SHA-256";
  static final Duration VALIDITY = Duration.ofHours(24);

  private final EmailVerificationTokenRepository repository;
  private final Clock clock;
  private final SecureRandom random = new SecureRandom();

  public VerificationTokens(EmailVerificationTokenRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  /** @return the raw token for the link; only its hash is kept */
  public String issue(UserEntity user) {
    byte[] bytes = new byte[TOKEN_BYTES];
    random.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    Instant now = clock.instant();
    repository.save(new EmailVerificationTokenEntity(user, hash(token), now, now.plus(VALIDITY)));
    return token;
  }

  /**
   * The token's user, once: the token is spent. Empty when unknown, used or expired. Spending is a
   * single conditional update, so two simultaneous clicks cannot both succeed.
   */
  public Optional<UserEntity> redeem(String token) {
    String tokenHash = hash(token);
    if (repository.spendIfUsable(tokenHash, clock.instant()) == 0) {
      return Optional.empty();
    }
    return repository.findByTokenHash(tokenHash).map(EmailVerificationTokenEntity::getUser);
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
