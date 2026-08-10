package com.enterprise.itmapping.feature.changedetection.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChangeDetectionItemRepository
    extends JpaRepository<ChangeDetectionItemEntity, UUID> {

  List<ChangeDetectionItemEntity> findByRun_IdOrderByCreatedAtAsc(UUID runId);

  Optional<ChangeDetectionItemEntity> findByIdAndRun_Id(UUID id, UUID runId);

  long countByStatus(
      com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemStatus status);
}
