package com.enterprise.itmapping.feature.applications.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiDecisionSourceRepository extends JpaRepository<AiDecisionSourceEntity, UUID> {

  List<AiDecisionSourceEntity> findByTargetTypeAndTargetIdOrderByCreatedAtAsc(
      String targetType, String targetId);
}
