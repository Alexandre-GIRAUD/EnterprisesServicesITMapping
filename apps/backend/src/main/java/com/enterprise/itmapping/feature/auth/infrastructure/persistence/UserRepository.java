package com.enterprise.itmapping.feature.auth.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

  Optional<UserEntity> findByUsernameIgnoreCase(String username);

  boolean existsByUsernameIgnoreCase(String username);

  List<UserEntity> findAllByOrderByUsernameAsc();
}
