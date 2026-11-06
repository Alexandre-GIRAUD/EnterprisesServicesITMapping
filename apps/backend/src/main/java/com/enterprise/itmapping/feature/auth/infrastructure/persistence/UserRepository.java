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

  Optional<UserEntity> findByEmailIgnoreCase(String email);

  List<UserEntity> findAllByStatusAndCreatedAtBefore(UserStatus status, Instant createdBefore);
}
