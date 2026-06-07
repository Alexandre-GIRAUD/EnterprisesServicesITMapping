package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ModuleGraphLoader;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeProjection;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Module composition graph for one {@link com.enterprise.itmapping.domain.Application} (same JSON
 * shape as {@link com.enterprise.itmapping.feature.graph.application.GraphService#getGraph}).
 *
 * <p><b>HTTP semantics:</b> {@code Optional.empty()} means the application id is unknown → caller
 * should respond with <b>404</b>. When the application exists but has no modules, returns <b>200</b>
 * with the root Application node and empty edges.
 *
 * <p>{@code description} is forwarded from Neo4j for Application and Module nodes when non-blank
 * (property already stored on {@code :Module} / {@code :Application}).
 */
@Service
public class ModuleGraphService {

  private final ModuleGraphLoader moduleGraphLoader;

  public ModuleGraphService(ModuleGraphLoader moduleGraphLoader) {
    this.moduleGraphLoader = moduleGraphLoader;
  }

  @Transactional(readOnly = true)
  public Optional<GraphResponseDto> getModuleGraph(String applicationId) {
    if (!moduleGraphLoader.applicationExists(applicationId)) {
      return Optional.empty();
    }

    List<ModuleGraphNodeRow> rows = moduleGraphLoader.loadNodes(applicationId);
    List<GraphEdgeProjection> edgeRows = moduleGraphLoader.loadEdges(applicationId);

    List<GraphNodeDto> nodes =
        rows.stream()
            .map(
                r ->
                    new GraphNodeDto(
                        r.id(),
                        r.name() != null && !r.name().isEmpty() ? r.name() : r.id(),
                        r.nodeType() != null ? r.nodeType() : "Module",
                        r.year(),
                        normalizedDescription(r.description())))
            .collect(Collectors.toList());

    List<GraphEdgeDto> edges = new ArrayList<>();
    int i = 0;
    for (GraphEdgeProjection e : edgeRows) {
      edges.add(
          new GraphEdgeDto("me" + i++, e.sourceId(), e.targetId(), e.type()));
    }

    return Optional.of(new GraphResponseDto(nodes, edges));
  }

  private static String normalizedDescription(String description) {
    if (description == null || description.isBlank()) {
      return null;
    }
    return description.trim();
  }
}
