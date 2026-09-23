package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttributeChangeEventRepository
    extends JpaRepository<AttributeChangeEventEntity, UUID> {

  Page<AttributeChangeEventEntity>
      findByTargetTypeAndTargetIdOrderByCreatedAtDesc(
          AuditTargetType targetType, String targetId, Pageable pageable);

  Page<AttributeChangeEventEntity>
      findByTargetTypeAndTargetIdAndFieldKeyOrderByCreatedAtDesc(
          AuditTargetType targetType, String targetId, String fieldKey, Pageable pageable);
}
