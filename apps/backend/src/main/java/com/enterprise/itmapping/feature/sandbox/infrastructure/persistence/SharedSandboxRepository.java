package com.enterprise.itmapping.feature.sandbox.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SharedSandboxRepository extends JpaRepository<SharedSandboxEntity, UUID> {

  List<SharedSandboxEntity> findByRecipient_IdOrderByCreatedAtAsc(UUID recipientId);

  Optional<SharedSandboxEntity> findByIdAndRecipient_Id(UUID id, UUID recipientId);
}
