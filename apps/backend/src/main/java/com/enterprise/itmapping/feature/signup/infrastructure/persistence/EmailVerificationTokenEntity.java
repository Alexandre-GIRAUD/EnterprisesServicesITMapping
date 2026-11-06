package com.enterprise.itmapping.feature.signup.infrastructure.persistence;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** One emailed verification link. Only the SHA-256 of the token is stored. */
@Entity
@Table(name = "email_verification_tokens")
public class EmailVerificationTokenEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false, updatable = false)
  private UserEntity user;

  @Column(name = "token_hash", nullable = false, updatable = false)
  private String tokenHash;

  @Column(name = "expires_at", nullable = false, updatable = false)
  private Instant expiresAt;

  @Column(name = "used_at")
  private Instant usedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected EmailVerificationTokenEntity() {}

  public EmailVerificationTokenEntity(
      UserEntity user, String tokenHash, Instant createdAt, Instant expiresAt) {
    this.id = UUID.randomUUID();
    this.user = user;
    this.tokenHash = tokenHash;
    this.createdAt = createdAt;
    this.expiresAt = expiresAt;
  }

  public UserEntity getUser() {
    return user;
  }
}
