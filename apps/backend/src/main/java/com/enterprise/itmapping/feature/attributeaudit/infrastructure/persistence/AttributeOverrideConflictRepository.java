package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.OverrideConflictStatus;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttributeOverrideConflictRepository
    extends JpaRepository<AttributeOverrideConflictEntity, UUID> {

  Page<AttributeOverrideConflictEntity> findByStatusOrderByCreatedAtDesc(
      OverrideConflictStatus status, Pageable pageable);

  Page<AttributeOverrideConflictEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

  long countByStatus(OverrideConflictStatus status);

  Optional<AttributeOverrideConflictEntity>
      findByTargetTypeAndTargetIdAndFieldKeyAndStatus(
          AuditTargetType targetType,
          String targetId,
          String fieldKey,
          OverrideConflictStatus status);
}
