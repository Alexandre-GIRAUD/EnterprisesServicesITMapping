package com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GraphViewFolderRepository extends JpaRepository<GraphViewFolderEntity, UUID> {

  List<GraphViewFolderEntity> findByUser_IdOrderByNameAsc(UUID userId);

  Optional<GraphViewFolderEntity> findByIdAndUser_Id(UUID id, UUID userId);

  @Query(
      """
      select (count(folder) > 0) from GraphViewFolderEntity folder
      where folder.user.id = :userId
        and lower(folder.name) = lower(:name)
        and (:ignoreId is null or folder.id <> :ignoreId)
        and ((:parentId is null and folder.parentId is null) or folder.parentId = :parentId)
      """)
  boolean existsSiblingName(
      @Param("userId") UUID userId,
      @Param("parentId") UUID parentId,
      @Param("name") String name,
      @Param("ignoreId") UUID ignoreId);
}
