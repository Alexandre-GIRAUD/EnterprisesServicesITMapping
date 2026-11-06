package com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence;

import com.enterprise.itmapping.feature.workspace.infrastructure.WorkspaceGraph;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

/** Applications at both ends of an edge, so its audit events show up in their history. */
@Component
public class EdgeEndpointLookup {

  private final WorkspaceGraph graph;

  public EdgeEndpointLookup(WorkspaceGraph graph) {
    this.graph = graph;
  }

  public List<String> applicationIds(String edgeId) {
    return graph
        .query(
            """
            MATCH (s {workspaceId: $workspaceId})-[r]->(t)
            WHERE r.id = $id
            RETURN s.id AS sourceId, t.id AS targetId
            LIMIT 1
            """)
        .bind(edgeId)
        .to("id")
        .fetch()
        .first()
        .map(
            row ->
                Stream.of(row.get("sourceId"), row.get("targetId"))
                    .filter(Objects::nonNull)
                    .map(String::valueOf)
                    .distinct()
                    .toList())
        .orElse(List.of());
  }
}
