package com.enterprise.itmapping;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.enterprise.itmapping.feature.applications.application.ApplicationModuleLifecycle;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeEventResponse;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.history.application.PastSystemView;
import com.enterprise.itmapping.feature.history.application.SystemStateCaptureService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/** Application, module and flow history, and the read-only view of a past day. */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class SystemHistoryIntegrationTest {

  private static final LocalDate CAPTURED_DAY = LocalDate.of(2026, 1, 15);
  private static final LocalDate BEFORE_ANY_CAPTURE = LocalDate.of(2000, 1, 1);

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

  @Autowired ApplicationService applicationService;
  @Autowired ApplicationModuleLifecycle moduleLifecycle;
  @Autowired AttributeChangeAuditService auditService;
  @Autowired GraphService graphService;
  @Autowired Neo4jClient neo4jClient;
  @Autowired SystemStateCaptureService captureService;
  @Autowired PastSystemView pastSystemView;

  @Test
  void applicationHistorySurvivesDeletionWithItsModulesAndFlows() {
    String appId = applicationService.create(new ApplicationRequest("History App", "")).id();
    String peerId = applicationService.create(new ApplicationRequest("History Peer", "")).id();
    applicationService.update(appId, new ApplicationRequest("History App v2", ""));
    createModule(appId);
    graphService.createEdge(new CreateGraphEdgeRequestDto(appId, peerId, "DEPENDS_ON"));

    applicationService.delete(appId);

    List<AttributeChangeEventResponse> events =
        auditService.listForApplication(appId, null, null, 0, 50).items();
    assertThat(events)
        .extracting(SystemHistoryIntegrationTest::describe)
        .contains(
            "APP_LINK created",
            "APP_FIELD name",
            "MODULE_LINK created",
            "EDGE_LINK created",
            "EDGE_LINK deleted",
            "MODULE_LINK deleted",
            "APP_LINK deleted");
  }

  @Test
  void historyOfAnApplicationIsFilteredByDate() {
    String appId = applicationService.create(new ApplicationRequest("Dated App", "")).id();
    LocalDate tomorrow = LocalDate.now().plusDays(1);

    assertThat(auditService.listForApplication(appId, null, null, 0, 50).items()).isNotEmpty();
    assertThat(auditService.listForApplication(appId, tomorrow, null, 0, 50).items()).isEmpty();
  }

  @Test
  void pastViewShowsTheCapturedDayAndLeavesTheLiveGraphUntouched() {
    String appId = applicationService.create(new ApplicationRequest("Before", "")).id();
    captureService.captureFor(CAPTURED_DAY);
    applicationService.update(appId, new ApplicationRequest("After", ""));
    String laterId = applicationService.create(new ApplicationRequest("Created later", "")).id();

    try (PastSystemView.Session ignored = pastSystemView.open(CAPTURED_DAY)) {
      assertThat(labelsOf(List.of(appId, laterId))).containsExactly("Before");
    }
    assertThat(labelsOf(List.of(appId, laterId))).containsExactlyInAnyOrder("After", "Created later");
  }

  @Test
  void dayBeforeTheFirstCaptureIsRejected() {
    captureService.captureFor(CAPTURED_DAY);

    assertThatThrownBy(() -> pastSystemView.open(BEFORE_ANY_CAPTURE))
        .isInstanceOf(ResponseStatusException.class);
  }

  private List<String> labelsOf(List<String> applicationIds) {
    return graphService.getGraph(applicationIds, Map.of()).nodes().stream()
        .map(GraphNodeDto::label)
        .toList();
  }

  private void createModule(String applicationId) {
    String moduleId = UUID.randomUUID().toString();
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $appId})
            CREATE (a)-[:CONTAINS]->(:Module {id: $moduleId, name: 'Billing', description: ''})
            """)
        .bindAll(Map.of("appId", applicationId, "moduleId", moduleId))
        .run();
    moduleLifecycle.recordCreated(applicationId, moduleId, "Billing");
  }

  private static String describe(AttributeChangeEventResponse event) {
    if (!event.fieldKey().startsWith("__")) {
      return event.fieldScope() + " " + event.fieldKey();
    }
    return event.fieldScope() + (event.newValue() == null ? " deleted" : " created");
  }
}
