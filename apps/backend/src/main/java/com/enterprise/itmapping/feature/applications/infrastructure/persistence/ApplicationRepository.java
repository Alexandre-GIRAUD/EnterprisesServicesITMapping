package com.enterprise.itmapping.feature.applications.infrastructure.persistence;

import com.enterprise.itmapping.domain.Application;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import java.util.List;
import java.util.Optional;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends Neo4jRepository<Application, String> {

  /**
   * Graph API: only node properties, no relationship hydration (safe with raw Cypher relationships).
   */
  default List<ApplicationGraphNodeProjection> findAllForGraph() {
    return findAllForGraphIn(CurrentWorkspace.requireId().toString());
  }

  default Optional<ApplicationGraphNodeProjection> findProjectionById(String id) {
    return findProjectionByIdIn(CurrentWorkspace.requireId().toString(), id);
  }

  @Query("""
      MATCH (a:Application {workspaceId: $workspaceId})
      RETURN a.id AS id, a.name AS name, a.description AS description
      ORDER BY name
      """)
  List<ApplicationGraphNodeProjection> findAllForGraphIn(@Param("workspaceId") String workspaceId);

  @Query("""
      MATCH (a:Application {workspaceId: $workspaceId})
      WHERE a.id = $id
      RETURN a.id AS id, a.name AS name, a.description AS description
      LIMIT 1
      """)
  Optional<ApplicationGraphNodeProjection> findProjectionByIdIn(
      @Param("workspaceId") String workspaceId, @Param("id") String id);
}
