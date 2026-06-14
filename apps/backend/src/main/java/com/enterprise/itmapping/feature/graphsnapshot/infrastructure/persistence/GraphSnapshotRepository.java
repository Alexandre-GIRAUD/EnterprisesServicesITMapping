package com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GraphSnapshotRepository extends JpaRepository<GraphSnapshotEntity, UUID> {

  List<GraphSnapshotEntity> findByUser_IdOrderByCreatedAtDesc(UUID userId);

  Optional<GraphSnapshotEntity> findByIdAndUser_Id(UUID id, UUID userId);

  boolean existsByUser_IdAndNameIgnoreCase(UUID userId, String name);
}
