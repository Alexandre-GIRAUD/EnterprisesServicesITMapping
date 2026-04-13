package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.domain.VersionSnapshot;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.GraphLoader;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.VersionSnapshotRepository;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.VersionSnapshotDto;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GraphService {

  private final GraphLoader graphLoader;
  private final VersionSnapshotRepository versionSnapshotRepository;

  public GraphService(GraphLoader graphLoader, VersionSnapshotRepository versionSnapshotRepository) {
    this.graphLoader = graphLoader;
    this.versionSnapshotRepository = versionSnapshotRepository;
  }

  /**
   * Creates a VersionSnapshot node and links it to all nodes currently valid (validTo IS NULL).
   */
  @Transactional
  public VersionSnapshotDto createNewSnapshot(String versionName) {
    Instant now = Instant.now();
    VersionSnapshot snapshot = new VersionSnapshot();
    snapshot.setVersionTag(versionName);
    snapshot.setValidFrom(now);
    snapshot.setValidTo(null);
    VersionSnapshot saved = versionSnapshotRepository.save(snapshot);
    int linked = graphLoader.linkCurrentNodesToSnapshot(saved.getId(), now);
    return new VersionSnapshotDto(
        saved.getId(),
        saved.getVersionTag(),
        saved.getDescription(),
        saved.getValidFrom(),
        saved.getValidTo(),
        linked
    );
  }

  /**
   * Returns only nodes and relationships valid at the given date.
   * Uses index-optimized temporal predicates for large graphs.
   */
  @Transactional(readOnly = true)
  public GraphResponseDto getGraphAtDate(Date date) {
    Instant pointInTime = date != null ? date.toInstant() : Instant.now();
    return getGraph(pointInTime);
  }

  @Transactional(readOnly = true)
  public GraphResponseDto getGraph(Instant validAt) {
    Instant pointInTime = validAt != null ? validAt : Instant.now();
    List<GraphEdgeProjection> edges = graphLoader.loadEdges(pointInTime);

    List<GraphNodeDto> nodes =
        graphLoader.loadNodesValidAt(pointInTime).stream()
            .map(
                a ->
                    new GraphNodeDto(
                        a.id(),
                        a.name() != null ? a.name() : a.id(),
                        "Application",
                        toTemporalDto(a.validFrom(), a.validTo())))
            .collect(Collectors.toList());

    List<GraphEdgeDto> edgeDtos = new ArrayList<>();
    int i = 0;
    for (GraphEdgeProjection e : edges) {
      edgeDtos.add(new GraphEdgeDto(
          "e" + i++,
          e.sourceId(),
          e.targetId(),
          e.type()
      ));
    }

    return new GraphResponseDto(nodes, edgeDtos);
  }

  private static GraphNodeDto.TemporalDto toTemporalDto(java.time.Instant from, java.time.Instant to) {
    return new GraphNodeDto.TemporalDto(
        from != null ? from.toString() : null,
        to != null ? to.toString() : null
    );
  }
}
