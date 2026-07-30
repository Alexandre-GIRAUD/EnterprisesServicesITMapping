package com.enterprise.itmapping.feature.applications.infrastructure.persistence;

import com.enterprise.itmapping.domain.Application;
import java.util.List;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends Neo4jRepository<Application, String> {

  /**
   * Graph API: only node properties, no relationship hydration (safe with raw Cypher relationships).
   */
  @Query("""
      MATCH (a:Application)
      RETURN a.id AS id, a.name AS name, a.description AS description
      ORDER BY name
      """)
  List<ApplicationGraphNodeProjection> findAllForGraph();

  @Query("""
      MATCH (a:Application)
      WHERE a.id = $id
      RETURN a.id AS id, a.name AS name, a.description AS description
      LIMIT 1
      """)
  java.util.Optional<ApplicationGraphNodeProjection> findByIdForGraph(@Param("id") String id);

  @Query("""
      MATCH (a:Application {id: $id})
      RETURN a.id AS id, a.name AS name, a.description AS description
      LIMIT 1
      """)
  java.util.Optional<ApplicationGraphNodeProjection> findProjectionById(@Param("id") String id);
}
