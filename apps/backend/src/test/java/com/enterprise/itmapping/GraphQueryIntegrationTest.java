package com.enterprise.itmapping;

import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.GraphLoader;
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

/**
 * Integration tests for the graph read model: module-graph plus the two filter axes (application
 * ids and Data Model {@code target=NODE} properties). Node-attribute filtering is exercised through
 * {@link GraphLoader} because {@link GraphService} only accepts keys declared in the Data Model.
 */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class GraphQueryIntegrationTest {

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
  GraphLoader graphLoader;

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
              CREATE (a:Application {id: $appId, name: 'ModParent', description: ''})
              CREATE (x:Module {id: $m1, name: 'M1', description: ''})
              CREATE (y:Module {id: $m2, name: 'M2', description: ''})
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
  @DisplayName("graph filtered by application ids")
  class GraphFilteredByApplicationIds {

    @Test
    @DisplayName("keeps only the requested applications and the edges inside that set")
    void filtersNodesAndEdges() {
      String appA = UUID.randomUUID().toString();
      String appB = UUID.randomUUID().toString();
      String appC = UUID.randomUUID().toString();
      createApplications(appA, appB, appC);

      GraphResponseDto filtered = graphService.getGraph(List.of(appA, appB), Map.of());

      assertThat(filtered.nodes().stream().map(n -> n.id()).toList())
          .containsExactlyInAnyOrder(appA, appB);
      assertThat(filtered.edges()).hasSize(1);
      assertThat(filtered.edges().getFirst().sourceId()).isEqualTo(appA);
      assertThat(filtered.edges().getFirst().targetId()).isEqualTo(appB);
    }

    @Test
    @DisplayName("unknown application id yields an empty graph")
    void unknownIdReturnsEmpty() {
      GraphResponseDto graph =
          graphService.getGraph(List.of(UUID.randomUUID().toString()), Map.of());
      assertThat(graph.nodes()).isEmpty();
      assertThat(graph.edges()).isEmpty();
    }
  }

  @Nested
  @DisplayName("graph filtered by Data Model NODE attributes")
  class GraphFilteredByNodeAttributes {

    @Test
    @DisplayName("values inside one key combine with OR, keys with AND")
    void filtersOnFlatApplicationProperties() {
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
              CREATE (a:Application {id: $appA, name: 'A', description: '', tier: 'GOLD', region: 'EMEA'})
              CREATE (b:Application {id: $appB, name: 'B', description: '', tier: 'SILVER', region: 'EMEA'})
              CREATE (c:Application {id: $appC, name: 'C', description: '', tier: 'GOLD', region: 'APAC'})
              CREATE (a)-[:DEPENDS_ON]->(b)
              CREATE (a)-[:DEPENDS_ON]->(c)
              """)
          .bindAll(bind)
          .run();

      var byTier =
          graphLoader.loadNodes(null, Map.of("tier", List.of("GOLD", "SILVER"))).stream()
              .map(row -> row.id())
              .toList();
      assertThat(byTier).contains(appA, appB, appC);

      var goldEmea =
          graphLoader
              .loadNodes(null, Map.of("tier", List.of("GOLD"), "region", List.of("EMEA")))
              .stream()
              .map(row -> row.id())
              .toList();
      assertThat(goldEmea).contains(appA).doesNotContain(appB, appC);

      var edges = graphLoader.loadEdges(null, Map.of("region", List.of("EMEA")));
      assertThat(edges.stream().map(e -> e.sourceId() + "->" + e.targetId()))
          .contains(appA + "->" + appB)
          .doesNotContain(appA + "->" + appC);
    }

    @Test
    @DisplayName("unknown value yields an empty node set")
    void unknownValueReturnsEmpty() {
      assertThat(graphLoader.loadNodes(null, Map.of("tier", List.of("__none__")))).isEmpty();
    }

    @Test
    @DisplayName("node rows expose business properties and hide identity ones")
    void exposesBusinessPropertiesOnly() {
      String appId = UUID.randomUUID().toString();
      neo4jClient
          .query(
              """
              CREATE (a:Application {id: $appId, name: 'Props', description: 'd', tier: 'BRONZE'})
              """)
          .bind(appId)
          .to("appId")
          .run();

      var row =
          graphLoader.loadNodes(List.of(appId), Map.of()).stream().findFirst().orElseThrow();
      assertThat(row.properties()).containsEntry("tier", "BRONZE");
      assertThat(row.properties()).doesNotContainKeys("id", "name", "description");
    }
  }

  @Nested
  @DisplayName("application detail")
  class ApplicationDetail {

    @Test
    @DisplayName("exposes flat business properties as node attributes")
    void findByIdExposesNodeAttributes() {
      String appId = UUID.randomUUID().toString();
      neo4jClient
          .query(
              """
              CREATE (a:Application {id: $appId, name: 'AppX', description: '', tier: 'GOLD'})
              """)
          .bind(appId)
          .to("appId")
          .run();

      var res = applicationService.findById(appId).orElseThrow();
      assertThat(res.nodeAttributes()).containsEntry("tier", "GOLD");
    }

    @Test
    @DisplayName("has empty node attributes when the application carries none")
    void findByIdWithoutNodeAttributes() {
      String appId = UUID.randomUUID().toString();
      neo4jClient
          .query("CREATE (a:Application {id: $appId, name: 'Solo', description: ''})")
          .bind(appId)
          .to("appId")
          .run();

      var res = applicationService.findById(appId).orElseThrow();
      assertThat(res.nodeAttributes()).isEmpty();
    }
  }

  private void createApplications(String appA, String appB, String appC) {
    Map<String, Object> bind = new HashMap<>();
    bind.put("appA", appA);
    bind.put("appB", appB);
    bind.put("appC", appC);
    neo4jClient
        .query(
            """
            CREATE (a:Application {id: $appA, name: 'A', description: ''})
            CREATE (b:Application {id: $appB, name: 'B', description: ''})
            CREATE (c:Application {id: $appC, name: 'C', description: ''})
            CREATE (a)-[:DEPENDS_ON]->(b)
            CREATE (a)-[:DEPENDS_ON]->(c)
            """)
        .bindAll(bind)
        .run();
  }
}
