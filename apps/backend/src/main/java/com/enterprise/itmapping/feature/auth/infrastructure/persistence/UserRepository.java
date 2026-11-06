package com.enterprise.itmapping.feature.auth.infrastructure.persistence;

import com.enterprise.itmapping.feature.auth.domain.UserStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

  Optional<UserEntity> findByUsernameIgnoreCase(String username);

  boolean existsByUsernameIgnoreCase(String username);

  /** Users other people of a workspace may address, for example to share with. */
  Optional<UserEntity> findByUsernameIgnoreCaseAndWorkspaceId(String username, UUID workspaceId);

  List<UserEntity> findAllByWorkspaceIdOrderByUsernameAsc(UUID workspaceId);

  boolean existsByEmailIgnoreCase(String email);

  /**
   * The user a session token names. The subject is the user id, which never changes, so a session
   * stays with its account when the username changes and never follows a reused address.
   */
  default Optional<UserEntity> findBySessionSubject(String subject) {
    try {
      return findById(UUID.fromString(subject));
    } catch (IllegalArgumentException notAnId) {
      return Optional.empty();
    }
  }

  /** Whether {@code email} already signs in an account, as its email or as its username. */
  default boolean existsAccountFor(String email) {
    return existsByEmailIgnoreCase(email) || existsByUsernameIgnoreCase(email);
  }

  boolean existsByWorkspaceId(UUID workspaceId);

  Optional<UserEntity> findByEmailIgnoreCase(String email);

  List<UserEntity> findAllByStatusAndCreatedAtBefore(UserStatus status, Instant createdBefore);
}
