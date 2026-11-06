package com.enterprise.itmapping.feature.signup.infrastructure.persistence;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.signup.domain.TokenPurpose;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** One emailed account link. Only the SHA-256 of the token is stored. */
@Entity
@Table(name = "account_tokens")
public class AccountTokenEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false, updatable = false)
  private UserEntity user;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, updatable = false, length = 32)
  private TokenPurpose purpose;

  /** The address to confirm, for {@link TokenPurpose#CHANGE_EMAIL} only. */
  @Column(name = "new_email", updatable = false)
  private String newEmail;

  @Column(name = "token_hash", nullable = false, updatable = false)
  private String tokenHash;

  @Column(name = "expires_at", nullable = false, updatable = false)
  private Instant expiresAt;

  @Column(name = "used_at")
  private Instant usedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected AccountTokenEntity() {}

  public AccountTokenEntity(
      UserEntity user,
      TokenPurpose purpose,
      String newEmail,
      String tokenHash,
      Instant createdAt) {
    this.id = UUID.randomUUID();
    this.user = user;
    this.purpose = purpose;
    this.newEmail = newEmail;
    this.tokenHash = tokenHash;
    this.createdAt = createdAt;
    this.expiresAt = createdAt.plus(purpose.validity());
  }

  public UserEntity getUser() {
    return user;
  }

  public String getNewEmail() {
    return newEmail;
  }
}
