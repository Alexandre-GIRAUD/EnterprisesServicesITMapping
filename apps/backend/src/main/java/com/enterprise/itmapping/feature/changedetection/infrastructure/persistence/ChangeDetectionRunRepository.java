package com.enterprise.itmapping.feature.changedetection.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChangeDetectionRunRepository extends JpaRepository<ChangeDetectionRunEntity, UUID> {

  Optional<ChangeDetectionRunEntity> findByRepoFullNameIgnoreCaseAndCommitSha(
      String repoFullName, String commitSha);

  List<ChangeDetectionRunEntity> findByOrderByCreatedAtDesc();

  List<ChangeDetectionRunEntity> findByApplicationIdOrderByCreatedAtDesc(String applicationId);

  List<ChangeDetectionRunEntity> findByStatusOrderByCreatedAtDesc(
      com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionRunStatus status);
}
