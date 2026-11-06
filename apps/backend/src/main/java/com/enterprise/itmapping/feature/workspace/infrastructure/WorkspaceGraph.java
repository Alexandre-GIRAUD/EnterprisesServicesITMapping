package com.enterprise.itmapping.feature.workspace.infrastructure;

import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * The only way application code talks to Neo4j. Every statement must filter on
 * {@code $workspaceId}, which is bound to the current workspace: a statement that forgets it is
 * refused instead of reading or writing every workspace.
 */
@Component
public class WorkspaceGraph {

  public static final String WORKSPACE_PARAMETER = "workspaceId";

  private static final String WORKSPACE_PLACEHOLDER = "$" + WORKSPACE_PARAMETER;

  private final Neo4jClient neo4jClient;

  public WorkspaceGraph(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public Neo4jClient.RunnableSpec query(String cypher) {
    if (!cypher.contains(WORKSPACE_PLACEHOLDER)) {
      throw new IllegalArgumentException(
          "Cypher must filter on " + WORKSPACE_PLACEHOLDER + ": " + cypher);
    }
    String workspaceId = CurrentWorkspace.requireId().toString();
    return neo4jClient.query(cypher).bind(workspaceId).to(WORKSPACE_PARAMETER);
  }
}
