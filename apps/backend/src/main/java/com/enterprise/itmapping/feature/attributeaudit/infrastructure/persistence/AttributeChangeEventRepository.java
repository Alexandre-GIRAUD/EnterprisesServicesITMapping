package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttributeChangeEventRepository
    extends JpaRepository<AttributeChangeEventEntity, UUID> {

  Page<AttributeChangeEventEntity>
      findByTargetTypeAndTargetIdOrderByCreatedAtDesc(
          AuditTargetType targetType, String targetId, Pageable pageable);

  Page<AttributeChangeEventEntity>
      findByTargetTypeAndTargetIdAndFieldKeyOrderByCreatedAtDesc(
          AuditTargetType targetType, String targetId, String fieldKey, Pageable pageable);

  /** Events of one application, its modules and its flows, created in {@code [from, to)}. */
  @Query(
      value =
          """
          SELECT * FROM attribute_change_events
          WHERE application_ids @> jsonb_build_array(CAST(:applicationId AS text))
            AND created_at >= :from AND created_at < :to
          ORDER BY created_at DESC
          """,
      countQuery =
          """
          SELECT count(*) FROM attribute_change_events
          WHERE application_ids @> jsonb_build_array(CAST(:applicationId AS text))
            AND created_at >= :from AND created_at < :to
          """,
      nativeQuery = true)
  Page<AttributeChangeEventEntity> findForApplication(
      @Param("applicationId") String applicationId,
      @Param("from") Instant from,
      @Param("to") Instant to,
      Pageable pageable);
}
