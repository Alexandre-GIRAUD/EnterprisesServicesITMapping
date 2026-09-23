package com.enterprise.itmapping.feature.functionaldoc.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationFunctionalDocRepository
    extends JpaRepository<ApplicationFunctionalDocEntity, UUID> {

  Optional<ApplicationFunctionalDocEntity> findByApplicationId(String applicationId);
}
