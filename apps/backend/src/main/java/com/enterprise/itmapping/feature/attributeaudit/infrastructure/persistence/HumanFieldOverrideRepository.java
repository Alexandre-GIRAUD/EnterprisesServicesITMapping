package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HumanFieldOverrideRepository
    extends JpaRepository<HumanFieldOverrideEntity, HumanFieldOverrideEntity.Pk> {

  java.util.Optional<HumanFieldOverrideEntity> findByTargetTypeAndTargetIdAndFieldKey(
      AuditTargetType targetType, String targetId, String fieldKey);
}
