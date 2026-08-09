package com.enterprise.itmapping.feature.graph.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.GraphLoader;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;

@ExtendWith(MockitoExtension.class)
class GraphServiceEdgeFilterTest {

  @Mock GraphLoader graphLoader;
  @Mock Neo4jClient neo4jClient;
  @Mock ApplicationRepository applicationRepository;
  @Mock DataModelService dataModelService;

  private GraphService graphService;

  @BeforeEach
  void setUp() {
    graphService =
        new GraphService(
            graphLoader,
            neo4jClient,
            applicationRepository,
            dataModelService,
            new GraphNodeFilterResolver());
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeField("tier"), edgeField("data_category")));
  }

  @Test
  void edgeFilterKeepsOnlyApplicationsIncidentToMatchingEdges() {
    when(graphLoader.loadEdges(isNull(), eq(Map.of()), eq(Map.of()), eq(Map.of("data_category", List.of("ORDER")))))
        .thenReturn(List.of(new GraphEdgeProjection("app-a", "app-b", "DEPENDS_ON", null, "e1", Map.of())));
    when(graphLoader.loadNodes(isNull(), eq(Map.of()), eq(Map.of())))
        .thenReturn(
            List.of(
                node("app-a", "A"),
                node("app-b", "B"),
                node("app-c", "C")));

    GraphResponseDto graph =
        graphService.getGraph(null, Map.of(), Map.of(), Map.of("data_category", List.of("ORDER")));

    assertThat(graph.nodes()).extracting(n -> n.id()).containsExactlyInAnyOrder("app-a", "app-b");
    assertThat(graph.edges()).hasSize(1);
  }

  @Test
  void combinedNodeAndEdgeFiltersDropAppsOutsideSurvivingEdges() {
    when(graphLoader.loadEdges(
            isNull(),
            eq(Map.of("tier", List.of("GOLD"))),
            eq(Map.of()),
            eq(Map.of("data_category", List.of("ORDER")))))
        .thenReturn(List.of(new GraphEdgeProjection("app-a", "app-b", "DEPENDS_ON", null, "e1", Map.of())));
    when(graphLoader.loadNodes(isNull(), eq(Map.of("tier", List.of("GOLD"))), eq(Map.of())))
        .thenReturn(
            List.of(
                node("app-a", "A"),
                node("app-b", "B"),
                node("app-orphan", "Orphan")));

    GraphResponseDto graph =
        graphService.getGraph(
            null,
            Map.of("tier", List.of("GOLD")),
            Map.of(),
            Map.of("data_category", List.of("ORDER")));

    assertThat(graph.nodes()).extracting(n -> n.id()).containsExactlyInAnyOrder("app-a", "app-b");
    assertThat(graph.edges()).extracting(e -> e.id()).containsExactly("e1");
  }

  @Test
  void withoutEdgeFilterIsolatedApplicationsRemain() {
    when(graphLoader.loadEdges(isNull(), eq(Map.of()), eq(Map.of()), eq(Map.of())))
        .thenReturn(List.of(new GraphEdgeProjection("app-a", "app-b", "DEPENDS_ON", null, "e1", Map.of())));
    when(graphLoader.loadNodes(isNull(), eq(Map.of()), eq(Map.of())))
        .thenReturn(
            List.of(
                node("app-a", "A"),
                node("app-b", "B"),
                node("app-orphan", "Orphan")));

    GraphResponseDto graph = graphService.getGraph(null, Map.of(), Map.of(), Map.of());

    assertThat(graph.nodes())
        .extracting(n -> n.id())
        .containsExactlyInAnyOrder("app-a", "app-b", "app-orphan");
  }

  @Test
  void unknownEdgeKeyDoesNotDropIsolatedApplications() {
    when(graphLoader.loadEdges(isNull(), eq(Map.of()), eq(Map.of()), eq(Map.of())))
        .thenReturn(List.of());
    when(graphLoader.loadNodes(isNull(), eq(Map.of()), eq(Map.of())))
        .thenReturn(List.of(node("app-orphan", "Orphan")));

    GraphResponseDto graph =
        graphService.getGraph(null, Map.of(), Map.of(), Map.of("unknown_edge", List.of("X")));

    assertThat(graph.nodes()).extracting(n -> n.id()).containsExactly("app-orphan");
  }

  private static GraphNodeRow node(String id, String name) {
    return new GraphNodeRow(id, name, null, Map.of());
  }

  private static DataModelConfig config(DataModelField... fields) {
    return new DataModelConfig(List.of(fields));
  }

  private static DataModelField nodeField(String key) {
    return new DataModelField(
        key, key, "", "", List.of(), false, false, DataModelDetection.MANUAL, DataModelTarget.NODE);
  }

  private static DataModelField edgeField(String key) {
    return new DataModelField(
        key,
        key,
        "",
        "",
        List.of(),
        false,
        false,
        DataModelDetection.MANUAL,
        DataModelTarget.EDGE);
  }
}
