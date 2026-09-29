package com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GraphSnapshotRepository extends JpaRepository<GraphSnapshotEntity, UUID> {

  List<GraphSnapshotEntity> findByUser_IdOrderByCreatedAtDesc(UUID userId);

  Optional<GraphSnapshotEntity> findByIdAndUser_Id(UUID id, UUID userId);

  @Query(
      """
      select (count(snapshot) > 0) from GraphSnapshotEntity snapshot
      where snapshot.user.id = :userId
        and lower(snapshot.name) = lower(:name)
        and (:ignoreId is null or snapshot.id <> :ignoreId)
        and ((:folderId is null and snapshot.folderId is null) or snapshot.folderId = :folderId)
      """)
  boolean existsSiblingName(
      @Param("userId") UUID userId,
      @Param("folderId") UUID folderId,
      @Param("name") String name,
      @Param("ignoreId") UUID ignoreId);
}
