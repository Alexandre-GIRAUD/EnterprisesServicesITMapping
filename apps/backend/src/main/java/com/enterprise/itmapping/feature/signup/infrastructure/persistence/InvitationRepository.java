package com.enterprise.itmapping.feature.signup.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvitationRepository extends JpaRepository<InvitationEntity, UUID> {

  List<InvitationEntity> findAllByWorkspaceIdAndAcceptedAtIsNullOrderByCreatedAtDesc(
      UUID workspaceId);

  Optional<InvitationEntity> findByIdAndWorkspaceIdAndAcceptedAtIsNull(UUID id, UUID workspaceId);

  boolean existsByWorkspaceIdAndEmailIgnoreCaseAndAcceptedAtIsNull(UUID workspaceId, String email);

  Optional<InvitationEntity> findByTokenHash(String tokenHash);

  /** Marks the invitation accepted when it still can be; returns how many it accepted (0 or 1). */
  @Modifying
  @Query(
      """
      UPDATE InvitationEntity i SET i.acceptedAt = :now
      WHERE i.tokenHash = :tokenHash AND i.acceptedAt IS NULL AND i.expiresAt > :now
      """)
  int acceptIfOpen(@Param("tokenHash") String tokenHash, @Param("now") Instant now);

  @Modifying
  @Query("DELETE FROM InvitationEntity i WHERE i.acceptedAt IS NULL AND i.expiresAt < :before")
  int deleteExpiredBefore(@Param("before") Instant before);
}
