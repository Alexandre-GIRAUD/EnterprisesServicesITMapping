package com.enterprise.itmapping.feature.signup.infrastructure.persistence;

import com.enterprise.itmapping.feature.auth.domain.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * An emailed invitation to join a workspace. Not workspace-filtered by Hibernate: the invitee
 * accepts it before belonging to any workspace, so admin queries filter on the workspace
 * explicitly.
 */
@Entity
@Table(name = "invitations")
public class InvitationEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Column(name = "workspace_id", nullable = false, updatable = false)
  private UUID workspaceId;

  @Column(nullable = false, updatable = false)
  private String email;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, updatable = false, length = 32)
  private UserRole role;

  @Column(name = "token_hash", nullable = false)
  private String tokenHash;

  @Column(name = "invited_by", updatable = false)
  private UUID invitedBy;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "accepted_at")
  private Instant acceptedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected InvitationEntity() {}

  public InvitationEntity(
      UUID workspaceId, String email, UserRole role, UUID invitedBy, Instant createdAt) {
    this.id = UUID.randomUUID();
    this.workspaceId = workspaceId;
    this.email = email;
    this.role = role;
    this.invitedBy = invitedBy;
    this.createdAt = createdAt;
  }

  /** Points the invitation at a new link; the previous one stops working. */
  public void renew(String tokenHash, Instant expiresAt) {
    this.tokenHash = tokenHash;
    this.expiresAt = expiresAt;
  }

  public boolean isExpiredAt(Instant now) {
    return !now.isBefore(expiresAt);
  }

  public UUID getId() {
    return id;
  }

  public UUID getWorkspaceId() {
    return workspaceId;
  }

  public String getEmail() {
    return email;
  }

  public UserRole getRole() {
    return role;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }
}
