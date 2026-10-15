package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EntityValidationRepository
    extends JpaRepository<EntityValidationEntity, EntityValidationEntity.Pk> {}
