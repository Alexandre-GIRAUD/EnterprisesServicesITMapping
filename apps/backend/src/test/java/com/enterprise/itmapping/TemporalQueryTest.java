package com.enterprise.itmapping;

import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

/** Integration tests for the {@code year} filter and module-graph (replaces the temporal feature). */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class TemporalQueryTest {

  @Container
  static PostgreSQLContainer<?> postgres =
      new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
          .withDatabaseName("itmapping")
          .withUsername("itmapping")
          .withPassword("itmapping");

  @Container
  static Neo4jContainer<?> neo4j = new Neo4jContainer<>(DockerImageName.parse("neo4j:5-community"))
      .withAdminPassword("password");

  @DynamicPropertySource
  static void containerProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.neo4j.uri", neo4j::getBoltUrl);
    registry.add("spring.neo4j.authentication.username", () -> "neo4j");
    registry.add("spring.neo4j.authentication.password", neo4j::getAdminPassword);
    registry.add("app.sample-data.seed", () -> "false");
  }

  @Autowired
  ApplicationService applicationService;

  @Autowired
  GraphService graphService;

  @Autowired
  ModuleGraphService moduleGraphService;

  @Autowired
  Neo4jClient neo4jClient;

  @Nested
  @DisplayName("module-graph")
  class ModuleGraph {

    @Test
    @DisplayName("returns Application + Module nodes and CONTAINS edges for GET semantics")
    void returnsSubgraph() {
      String appId = UUID.randomUUID().toString();
      String m1 = UUID.randomUUID().toString();
      String m2 = UUID.randomUUID().toString();
      Map<String, Object> bind = new HashMap<>();
      bind.put("appId", appId);
      bind.put("m1", m1);
      bind.put("m2", m2);
      neo4jClient
          .query(
              """
              CREATE (a:Application {id: $appId, name: 'ModParent', description: '', year: 2025})
              CREATE (x:Module {id: $m1, name: 'M1', description: '', year: 2025})
              CREATE (y:Module {id: $m2, name: 'M2', description: '', year: 2025})
              CREATE (a)-[:CONTAINS]->(x)
              CREATE (x)-[:CONTAINS]->(y)
              """)
          .bindAll(bind)
          .run();

      var graph = moduleGraphService.getModuleGraph(appId).orElseThrow();

      assertThat(graph.nodes()).hasSize(3);
      assertThat(graph.nodes().stream().map(n -> n.type()).distinct())
          .containsExactlyInAnyOrder("Application", "Module");
      assertThat(graph.edges()).hasSize(2);
      assertThat(graph.edges().stream().map(e -> e.type()).distinct()).containsExactly("CONTAINS");
    }

    @Test
    @DisplayName("returns empty when application id is unknown")
    void returnsEmptyForUnknownApp() {
      assertThat(moduleGraphService.getModuleGraph("no-such-app-id-xyz")).isEmpty();
    }
  }

  @Nested
  @DisplayName("graph filtered by year")
  class GraphFilteredByYear {

    @Test
    @DisplayName("returns only applications with the given year; null year returns all")
    void filtersByYear() {
      String appA = UUID.randomUUID().toString();
      String appB = UUID.randomUUID().toString();
      String appC = UUID.randomUUID().toString();
      Map<String, Object> bind = new HashMap<>();
      bind.put("appA", appA);
      bind.put("appB", appB);
      bind.put("appC", appC);
      neo4jClient
          .query(
              """
              CREATE (a:Application {id: $appA, name: 'A', description: '', year: 2025})
              CREATE (b:Application {id: $appB, name: 'B', description: '', year: 2025})
              CREATE (c:Application {id: $appC, name: 'C', description: '', year: 2023})
              CREATE (a)-[:DEPENDS_ON]->(b)
              CREATE (a)-[:DEPENDS_ON]->(c)
              """)
          .bindAll(bind)
          .run();

      GraphResponseDto all = graphService.getGraph(null, null, null, null);
      assertThat(all.nodes()).hasSize(3);

      GraphResponseDto only2025 = graphService.getGraph(2025, null, null, null);
      assertThat(only2025.nodes().stream().map(n -> n.id()).toList())
          .containsExactlyInAnyOrder(appA, appB);
      assertThat(only2025.edges()).hasSize(1);
      assertThat(only2025.edges().getFirst().sourceId()).isEqualTo(appA);
      assertThat(only2025.edges().getFirst().targetId()).isEqualTo(appB);
    }

    @Test
    @DisplayName("unknown year yields empty graph")
    void unknownYearReturnsEmpty() {
      GraphResponseDto graph = graphService.getGraph(1900, null, null, null);
      assertThat(graph.nodes()).isEmpty();
      assertThat(graph.edges()).isEmpty();
    }
  }

  @Nested
  @DisplayName("graph filtered by business unit")
  class GraphFilteredByBusinessUnit {

    @Test
    @DisplayName("returns only applications linked to the BU and edges inside that set")
    void filtersNodesAndEdges() {
      String buId = UUID.randomUUID().toString();
      String appA = UUID.randomUUID().toString();
      String appB = UUID.randomUUID().toString();
      String appC = UUID.randomUUID().toString();
      Map<String, Object> bind = new HashMap<>();
      bind.put("buId", buId);
      bind.put("appA", appA);
      bind.put("appB", appB);
      bind.put("appC", appC);
      neo4jClient
          .query(
              """
              CREATE (bu:BusinessUnit {id: $buId, name: 'BU1', code: 'B1', description: ''})
              CREATE (a:Application {id: $appA, name: 'A', description: '', year: 2025})
              CREATE (b:Application {id: $appB, name: 'B', description: '', year: 2025})
              CREATE (c:Application {id: $appC, name: 'C', description: '', year: 2025})
              CREATE (bu)-[:HAS_APPLICATION]->(a)
              CREATE (bu)-[:HAS_APPLICATION]->(b)
              CREATE (a)-[:DEPENDS_ON]->(b)
              CREATE (a)-[:DEPENDS_ON]->(c)
              """)
          .bindAll(bind)
          .run();

      GraphResponseDto all = graphService.getGraph(null, null, null, null);
      assertThat(all.nodes()).hasSize(3);

      GraphResponseDto filtered = graphService.getGraph(null, null, List.of(buId), null);
      assertThat(filtered.nodes()).hasSize(2);
      assertThat(filtered.nodes().stream().map(n -> n.id()).toList())
          .containsExactlyInAnyOrder(appA, appB);
      assertThat(filtered.edges()).hasSize(1);
      assertThat(filtered.edges().getFirst().sourceId()).isEqualTo(appA);
      assertThat(filtered.edges().getFirst().targetId()).isEqualTo(appB);
    }

    @Test
    @DisplayName("unknown business unit id yields empty graph")
    void unknownBuReturnsEmpty() {
      GraphResponseDto graph =
          graphService.getGraph(null, null, List.of(UUID.randomUUID().toString()), null);
      assertThat(graph.nodes()).isEmpty();
      assertThat(graph.edges()).isEmpty();
    }

    @Test
    @DisplayName("application detail includes business unit when linked")
    void findByIdIncludesBusinessUnit() {
      String buId = UUID.randomUUID().toString();
      String appId = UUID.randomUUID().toString();
      Map<String, Object> bind = new HashMap<>();
      bind.put("buId", buId);
      bind.put("appId", appId);
      neo4jClient
          .query(
              """
              CREATE (bu:BusinessUnit {id: $buId, name: 'BU X', code: 'BX', description: 'd'})
              CREATE (a:Application {id: $appId, name: 'AppX', description: '', year: 2025})
              CREATE (bu)-[:HAS_APPLICATION]->(a)
              """)
          .bindAll(bind)
          .run();

      var res = applicationService.findById(appId).orElseThrow();
      assertThat(res.businessUnit()).isNotNull();
      assertThat(res.businessUnit().id()).isEqualTo(buId);
      assertThat(res.businessUnit().name()).isEqualTo("BU X");
      assertThat(res.year()).isEqualTo(2025);
    }

    @Test
    @DisplayName("application detail has null business unit when not linked")
    void findByIdWithoutBusinessUnit() {
      String appId = UUID.randomUUID().toString();
      neo4jClient
          .query(
              """
              CREATE (a:Application {id: $appId, name: 'Solo', description: '', year: 2024})
              """)
          .bind(appId)
          .to("appId")
          .run();

      var res = applicationService.findById(appId).orElseThrow();
      assertThat(res.businessUnit()).isNull();
    }
  }

  @Nested
  @DisplayName("graph filtered by region")
  class GraphFilteredByRegion {

    @Test
    @DisplayName("returns only applications used in the region and edges inside that set")
    void filtersNodesAndEdges() {
      String appA = UUID.randomUUID().toString();
      String appB = UUID.randomUUID().toString();
      String appC = UUID.randomUUID().toString();
      Map<String, Object> bind = new HashMap<>();
      bind.put("appA", appA);
      bind.put("appB", appB);
      bind.put("appC", appC);
      neo4jClient
          .query(
              """
              CREATE (reg:Region {id: randomUUID(), code: 'EMEA', name: 'EMEA', description: ''})
              CREATE (a:Application {id: $appA, name: 'A', description: '', year: 2025})
              CREATE (b:Application {id: $appB, name: 'B', description: '', year: 2025})
              CREATE (c:Application {id: $appC, name: 'C', description: '', year: 2025})
              CREATE (a)-[:IS_USED_IN]->(reg)
              CREATE (b)-[:IS_USED_IN]->(reg)
              CREATE (a)-[:DEPENDS_ON]->(b)
              CREATE (a)-[:DEPENDS_ON]->(c)
              """)
          .bindAll(bind)
          .run();

      GraphResponseDto filtered = graphService.getGraph(null, null, null, List.of("EMEA"));
      assertThat(filtered.nodes()).hasSize(2);
      assertThat(filtered.nodes().stream().map(n -> n.id()).toList())
          .containsExactlyInAnyOrder(appA, appB);
      assertThat(filtered.edges()).hasSize(1);
      assertThat(filtered.edges().getFirst().sourceId()).isEqualTo(appA);
      assertThat(filtered.edges().getFirst().targetId()).isEqualTo(appB);
    }

    @Test
    @DisplayName("unknown region code yields empty graph")
    void unknownRegionReturnsEmpty() {
      GraphResponseDto graph = graphService.getGraph(null, null, null, List.of("NO_SUCH_REGION"));
      assertThat(graph.nodes()).isEmpty();
      assertThat(graph.edges()).isEmpty();
    }

    @Test
    @DisplayName("year, business unit and region filters intersect")
    void yearBuAndRegionIntersect() {
      String buId = UUID.randomUUID().toString();
      String appA = UUID.randomUUID().toString();
      String appB = UUID.randomUUID().toString();
      String appC = UUID.randomUUID().toString();
      Map<String, Object> bind = new HashMap<>();
      bind.put("buId", buId);
      bind.put("appA", appA);
      bind.put("appB", appB);
      bind.put("appC", appC);
      neo4jClient
          .query(
              """
              CREATE (bu:BusinessUnit {id: $buId, name: 'BU1', code: 'B1', description: ''})
              CREATE (reg:Region {id: randomUUID(), code: 'APAC', name: 'APAC', description: ''})
              CREATE (a:Application {id: $appA, name: 'A', description: '', year: 2025})
              CREATE (b:Application {id: $appB, name: 'B', description: '', year: 2023})
              CREATE (c:Application {id: $appC, name: 'C', description: '', year: 2025})
              CREATE (bu)-[:HAS_APPLICATION]->(a)
              CREATE (bu)-[:HAS_APPLICATION]->(b)
              CREATE (a)-[:IS_USED_IN]->(reg)
              CREATE (b)-[:IS_USED_IN]->(reg)
              CREATE (c)-[:IS_USED_IN]->(reg)
              """)
          .bindAll(bind)
          .run();

      GraphResponseDto filtered =
          graphService.getGraph(2025, null, List.of(buId), List.of("APAC"));
      assertThat(filtered.nodes()).hasSize(1);
      assertThat(filtered.nodes().getFirst().id()).isEqualTo(appA);
    }
  }
}
