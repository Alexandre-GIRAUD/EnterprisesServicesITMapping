package com.enterprise.itmapping.feature.comments.infrastructure.persistence;

import com.enterprise.itmapping.feature.comments.domain.CommentTargetType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EntityCommentRepository extends JpaRepository<EntityCommentEntity, UUID> {

  Page<EntityCommentEntity> findByTargetTypeAndTargetIdAndDeletedAtIsNullOrderByCreatedAtDesc(
      CommentTargetType targetType, String targetId, Pageable pageable);

  long countByTargetTypeAndTargetIdAndDeletedAtIsNull(
      CommentTargetType targetType, String targetId);

  Optional<EntityCommentEntity> findByIdAndDeletedAtIsNull(UUID id);
}
