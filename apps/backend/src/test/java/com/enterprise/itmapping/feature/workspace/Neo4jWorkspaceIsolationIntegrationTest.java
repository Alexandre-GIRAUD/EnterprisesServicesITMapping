package com.enterprise.itmapping.feature.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.enterprise.itmapping.config.Neo4jIndexConfig;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import com.enterprise.itmapping.feature.workspace.domain.Workspaces;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/** Graph nodes written in one workspace are invisible and untouchable from another. */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class Neo4jWorkspaceIsolationIntegrationTest {

  @Container
  static PostgreSQLContainer<?> postgres =
      new PostgreSQLContainer<>(
              DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"))
          .withDatabaseName("itmapping")
          .withUsername("itmapping")
          .withPassword("itmapping");

  @Container
  static Neo4jContainer<?> neo4j =
      new Neo4jContainer<>(DockerImageName.parse("neo4j:5-community")).withAdminPassword("password");

  @DynamicPropertySource
  static void containerProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.neo4j.uri", neo4j::getBoltUrl);
    registry.add("spring.neo4j.authentication.username", () -> "neo4j");
    registry.add("spring.neo4j.authentication.password", neo4j::getAdminPassword);
  }

  @Autowired JdbcTemplate jdbcTemplate;
  @Autowired Neo4jClient neo4jClient;
  @Autowired ApplicationService applicationService;
  @Autowired GraphService graphService;
  @Autowired ModuleGraphService moduleGraphService;
  @Autowired Neo4jIndexConfig neo4jIndexConfig;

  private UUID workspaceA;
  private UUID workspaceB;

  @BeforeEach
  void createTwoWorkspaces() {
    workspaceA = newWorkspace("A");
    workspaceB = newWorkspace("B");
  }

  @Test
  void applicationsOfOneWorkspaceAreInvisibleFromAnother() {
    String appOfA = createApplication(workspaceA, "Billing");

    CurrentWorkspace.runAs(
        workspaceB,
        () -> {
          assertThat(applicationService.findAll()).isEmpty();
          assertThat(applicationService.findById(appOfA)).isEmpty();
          assertThat(graphService.getGraph(List.of(appOfA), Map.of()).nodes()).isEmpty();
          assertThat(moduleGraphService.getModuleGraph(appOfA)).isEmpty();
        });
    CurrentWorkspace.runAs(
        workspaceA, () -> assertThat(applicationService.findById(appOfA)).isPresent());
  }

  @Test
  void anotherWorkspaceCannotDeleteOrLinkApplicationsItDoesNotOwn() {
    String first = createApplication(workspaceA, "Billing");
    String second = createApplication(workspaceA, "Ledger");

    CurrentWorkspace.runAs(
        workspaceB,
        () -> {
          assertThat(applicationService.delete(first)).isFalse();
          assertThatThrownBy(
                  () ->
                      graphService.createEdge(
                          new CreateGraphEdgeRequestDto(first, second, "DEPENDS_ON")))
              .isInstanceOf(ResponseStatusException.class);
        });
    CurrentWorkspace.runAs(
        workspaceA, () -> assertThat(applicationService.findAll()).hasSize(2));
  }

  @Test
  void nodesFromBeforeWorkspacesJoinTheDefaultWorkspaceAtStartup() {
    String legacyId = UUID.randomUUID().toString();
    neo4jClient
        .query("CREATE (:Application {id: $id, name: 'Legacy', description: ''})")
        .bind(legacyId)
        .to("id")
        .run();

    neo4jIndexConfig.run(new DefaultApplicationArguments());

    CurrentWorkspace.runAs(
        Workspaces.DEFAULT_ID,
        () -> assertThat(applicationService.findById(legacyId)).isPresent());
  }

  private String createApplication(UUID workspaceId, String name) {
    AtomicReference<String> id = new AtomicReference<>();
    CurrentWorkspace.runAs(
        workspaceId,
        () -> id.set(applicationService.create(new ApplicationRequest(name, "")).id()));
    return id.get();
  }

  private UUID newWorkspace(String name) {
    UUID id = UUID.randomUUID();
    jdbcTemplate.update("INSERT INTO workspaces (id, name) VALUES (?, ?)", id, name);
    return id;
  }
}
