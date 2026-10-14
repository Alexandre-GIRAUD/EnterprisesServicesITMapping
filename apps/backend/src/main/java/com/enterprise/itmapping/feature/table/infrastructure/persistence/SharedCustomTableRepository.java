package com.enterprise.itmapping.feature.table.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SharedCustomTableRepository extends JpaRepository<SharedCustomTableEntity, UUID> {

  List<SharedCustomTableEntity> findByRecipient_IdOrderByCreatedAtAsc(UUID recipientId);

  Optional<SharedCustomTableEntity> findByIdAndRecipient_Id(UUID id, UUID recipientId);
}
