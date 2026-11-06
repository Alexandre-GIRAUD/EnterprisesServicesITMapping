package com.enterprise.itmapping.feature.workspace;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.breach.domain.BreachCombinator;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.breach.infrastructure.persistence.BreachRuleEntity;
import com.enterprise.itmapping.feature.breach.infrastructure.persistence.BreachRuleRepository;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.infrastructure.persistence.DataModelEntity;
import com.enterprise.itmapping.feature.datamodel.infrastructure.persistence.DataModelRepository;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelFieldDto;
import com.enterprise.itmapping.feature.history.application.SystemState;
import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemDailyStateEntity;
import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemDailyStateRepository;
import com.enterprise.itmapping.feature.rag.domain.DocChunkDraft;
import com.enterprise.itmapping.feature.rag.infrastructure.FunctionalDocChunkRepository;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/** Rows written in one workspace are invisible from another; global names become per workspace. */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class PostgresWorkspaceIsolationIntegrationTest {

  private static final int EMBEDDING_DIMENSIONS = 1536;

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
  @Autowired BreachRuleRepository breachRules;
  @Autowired DataModelService dataModelService;
  @Autowired DataModelRepository dataModels;
  @Autowired SystemDailyStateRepository dailyStates;
  @Autowired FunctionalDocChunkRepository chunks;
  @Autowired AttributeChangeAuditService auditService;

  private UUID workspaceA;
  private UUID workspaceB;

  @BeforeEach
  void createTwoWorkspaces() {
    workspaceA = newWorkspace("A");
    workspaceB = newWorkspace("B");
  }

  @Test
  void breachRulesOfOneWorkspaceAreInvisibleFromAnotherAndNamesArePerWorkspace() {
    UUID ruleOfA = UUID.randomUUID();
    CurrentWorkspace.runAs(workspaceA, () -> breachRules.save(breachRule(ruleOfA, "Obsolete")));

    CurrentWorkspace.runAs(
        workspaceB,
        () -> {
          assertThat(breachRules.findAll()).isEmpty();
          assertThat(breachRules.findById(ruleOfA)).isEmpty();
          breachRules.saveAndFlush(breachRule(UUID.randomUUID(), "Obsolete"));
        });

    assertThat(countRows("breach_rules", workspaceA)).isEqualTo(1);
    assertThat(countRows("breach_rules", workspaceB)).isEqualTo(1);
  }

  @Test
  void eachWorkspaceReadsItsOwnDataModel() {
    CurrentWorkspace.runAs(
        workspaceA,
        () -> {
          DataModelEntity model = new DataModelEntity(workspaceA.toString());
          model.setFields(
              List.of(new DataModelFieldDto("tier", "Tier", "", "", List.of(), false, false).toDomain()));
          dataModels.save(model);
        });

    CurrentWorkspace.runAs(
        workspaceB, () -> assertThat(dataModelService.get().fields()).isEmpty());
    CurrentWorkspace.runAs(
        workspaceA, () -> assertThat(dataModelService.get().fields()).hasSize(1));
  }

  @Test
  void dailyStatesOfTheSameDayCoexistAcrossWorkspaces() {
    LocalDate day = LocalDate.of(2026, 1, 15);
    SystemState empty = new SystemState(List.of(), List.of(), List.of());
    CurrentWorkspace.runAs(
        workspaceA, () -> dailyStates.saveAndFlush(new SystemDailyStateEntity(day, empty, Instant.now())));
    CurrentWorkspace.runAs(
        workspaceB, () -> dailyStates.saveAndFlush(new SystemDailyStateEntity(day, empty, Instant.now())));

    CurrentWorkspace.runAs(workspaceB, () -> assertThat(dailyStates.findByDay(day)).isPresent());
    assertThat(countRows("system_daily_states", workspaceA)).isEqualTo(1);
  }

  @Test
  void functionalDocSearchOnlyReturnsChunksOfTheCallerWorkspace() {
    float[] embedding = new float[EMBEDDING_DIMENSIONS];
    embedding[0] = 1f;
    CurrentWorkspace.runAs(
        workspaceA,
        () ->
            chunks.insertAll(
                "app-1",
                UUID.randomUUID(),
                List.of(new DocChunkDraft("purpose", "Purpose", 0, "Pays invoices", "h1")),
                List.of(embedding)));

    CurrentWorkspace.runAs(
        workspaceB, () -> assertThat(chunks.search(embedding, null, 10)).isEmpty());
    CurrentWorkspace.runAs(
        workspaceA, () -> assertThat(chunks.search(embedding, null, 10)).hasSize(1));
  }

  @Test
  void applicationHistoryOnlyListsEventsOfTheCallerWorkspace() {
    jdbcTemplate.update(
        """
        INSERT INTO attribute_change_events
          (id, target_type, target_id, field_scope, field_key, actor_type, application_ids, workspace_id)
        VALUES (?, 'APPLICATION', 'app-1', 'APP_FIELD', 'name', 'HUMAN', '["app-1"]'::jsonb, ?)
        """,
        UUID.randomUUID(),
        workspaceA);

    CurrentWorkspace.runAs(
        workspaceB,
        () ->
            assertThat(auditService.listForApplication("app-1", null, null, 0, 10).totalElements())
                .isZero());
    CurrentWorkspace.runAs(
        workspaceA,
        () ->
            assertThat(auditService.listForApplication("app-1", null, null, 0, 10).totalElements())
                .isEqualTo(1));
  }

  private UUID newWorkspace(String name) {
    UUID id = UUID.randomUUID();
    jdbcTemplate.update("INSERT INTO workspaces (id, name) VALUES (?, ?)", id, name);
    return id;
  }

  private int countRows(String table, UUID workspaceId) {
    Integer n =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM " + table + " WHERE workspace_id = ?", Integer.class, workspaceId);
    return n != null ? n : 0;
  }

  private static BreachRuleEntity breachRule(UUID id, String name) {
    BreachRuleEntity rule = new BreachRuleEntity(id);
    rule.setName(name);
    rule.setSubject(BreachSubject.APPLICATION);
    rule.setDefinition(new BreachDefinition(BreachCombinator.AND, List.of()));
    return rule;
  }
}
