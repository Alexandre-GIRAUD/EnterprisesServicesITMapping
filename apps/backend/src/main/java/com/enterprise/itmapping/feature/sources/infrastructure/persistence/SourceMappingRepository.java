package com.enterprise.itmapping.feature.sources.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SourceMappingRepository extends JpaRepository<SourceMappingEntity, UUID> {

  List<SourceMappingEntity> findBySourceId(UUID sourceId);

  void deleteBySourceId(UUID sourceId);
}
