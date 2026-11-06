package com.enterprise.itmapping.feature.signup.infrastructure.persistence;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailVerificationTokenRepository
    extends JpaRepository<EmailVerificationTokenEntity, UUID> {

  Optional<EmailVerificationTokenEntity> findByTokenHash(String tokenHash);

  /** Marks the token used when it still can be; returns how many tokens it spent (0 or 1). */
  @Modifying
  @Query(
      """
      UPDATE EmailVerificationTokenEntity t SET t.usedAt = :now
      WHERE t.tokenHash = :tokenHash AND t.usedAt IS NULL AND t.expiresAt > :now
      """)
  int spendIfUsable(@Param("tokenHash") String tokenHash, @Param("now") Instant now);
}
