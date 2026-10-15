package com.enterprise.itmapping.feature.applications.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationDetectionDocumentRepository
    extends JpaRepository<ApplicationDetectionDocumentEntity, UUID> {

  Optional<ApplicationDetectionDocumentEntity> findByApplicationId(String applicationId);
}
