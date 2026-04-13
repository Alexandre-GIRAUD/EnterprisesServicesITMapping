package com.enterprise.itmapping.feature.applications.infrastructure.persistence;

import com.enterprise.itmapping.domain.Application;
import java.time.Instant;
import java.util.List;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends Neo4jRepository<Application, String> {

  @Query("""
      MATCH (a:Application)
      WHERE a.validFrom <= $validAt AND (a.validTo IS NULL OR a.validTo > $validAt)
      RETURN a
      ORDER BY a.name
      """)
  List<Application> findAllValidAt(@Param("validAt") Instant validAt);

  /**
   * Graph API: only node properties, no relationship hydration (safe with raw Cypher relationships).
   */
  @Query("""
      MATCH (a:Application)
      WHERE (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
      RETURN a.id AS id, a.name AS name, a.description AS description, a.validFrom AS validFrom, a.validTo AS validTo
      ORDER BY name
      """)
  List<ApplicationGraphNodeProjection> findAllValidAtForGraph(@Param("validAt") Instant validAt);

  @Query("""
      MATCH (a:Application)
      WHERE a.id = $id AND a.validFrom <= $validAt AND (a.validTo IS NULL OR a.validTo > $validAt)
      RETURN a
      """)
  java.util.Optional<Application> findByIdValidAt(@Param("id") String id, @Param("validAt") Instant validAt);

  /** Current version only: validTo IS NULL (index-friendly for temporal queries). */
  @Query("""
      MATCH (a:Application)
      WHERE a.id = $id AND a.validTo IS NULL
      RETURN a
      """)
  java.util.Optional<Application> findCurrentById(@Param("id") String id);

  @Query("""
      MATCH (a:Application)
      WHERE a.id = $id AND a.validTo IS NULL
      RETURN a.id AS id, a.name AS name, a.description AS description, a.validFrom AS validFrom, a.validTo AS validTo
      """)
  java.util.Optional<ApplicationGraphNodeProjection> findCurrentProjectionById(@Param("id") String id);

  @Query("""
      MATCH (a:Application)
      WHERE a.id = $id
        AND (a.validFrom IS NULL OR a.validFrom <= $validAt)
        AND (a.validTo IS NULL OR a.validTo > $validAt)
      RETURN a.id AS id, a.name AS name, a.description AS description, a.validFrom AS validFrom, a.validTo AS validTo
      """)
  java.util.Optional<ApplicationGraphNodeProjection> findByIdValidAtForGraph(
      @Param("id") String id, @Param("validAt") Instant validAt);

  @Query("""
      MATCH (a:Application {id: $id})
      RETURN a.id AS id, a.name AS name, a.description AS description, a.validFrom AS validFrom, a.validTo AS validTo
      LIMIT 1
      """)
  java.util.Optional<ApplicationGraphNodeProjection> findProjectionById(@Param("id") String id);
}
