package com.enterprise.itmapping.feature.breach.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachRuleRequest;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachRuleResponse;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import org.hibernate.LazyInitializationException;
import com.enterprise.itmapping.feature.breach.domain.BreachCombinator;
import com.enterprise.itmapping.feature.breach.domain.BreachCondition;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachGroup;
import com.enterprise.itmapping.feature.breach.domain.BreachOperator;
import com.enterprise.itmapping.feature.breach.domain.BreachScope;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.breach.infrastructure.persistence.BreachRuleEntity;
import com.enterprise.itmapping.feature.breach.infrastructure.persistence.BreachRuleRepository;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachSummaryResponse;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class BreachRuleServiceTest {

  private static final GraphResponseDto LIVE =
      new GraphResponseDto(
          List.of(
              new GraphNodeDto("billing", "Billing", "Application", null, Map.of("cost", "200k")),
              new GraphNodeDto("crm", "CRM", "Application", null, Map.of("cost", "5k")),
              new GraphNodeDto("ledger", "Ledger", "Application", null, Map.of("cost", "1k"))),
          List.of(
              new GraphEdgeDto("crm-ledger", "crm", "ledger", "DEPENDS_ON", null, Map.of("protocol", "FTP")),
              new GraphEdgeDto("billing-crm", "billing", "crm", "DEPENDS_ON", null, Map.of("protocol", "HTTPS"))));

  private final BreachRuleRepository repository = mock(BreachRuleRepository.class);
  private final GraphService graphService = mock(GraphService.class);
  private final DataModelService dataModelService = mock(DataModelService.class);
  private final CurrentUserResolver currentUserResolver = mock(CurrentUserResolver.class);
  private final BreachRuleService service =
      new BreachRuleService(
          repository,
          new BreachRuleValidator(),
          new BreachEvaluator(),
          dataModelService,
          graphService,
          currentUserResolver);

  private BreachRuleEntity expensiveApps;
  private BreachRuleEntity ftpFlows;

  private static BreachRuleEntity rule(String name, BreachSubject subject, BreachCondition condition) {
    BreachRuleEntity entity = new BreachRuleEntity(UUID.randomUUID());
    entity.setName(name);
    entity.setSubject(subject);
    entity.setDefinition(
        new BreachDefinition(
            BreachCombinator.AND, List.of(new BreachGroup(BreachCombinator.AND, List.of(condition)))));
    return entity;
  }

  @BeforeEach
  void storeTwoRules() {
    expensiveApps =
        rule(
            "Expensive apps",
            BreachSubject.APPLICATION,
            new BreachCondition(BreachScope.SELF, "cost", BreachOperator.GREATER_THAN, "100k"));
    ftpFlows =
        rule(
            "FTP flows",
            BreachSubject.FLOW,
            new BreachCondition(BreachScope.FLOW, "protocol", BreachOperator.EQUALS, "FTP"));
    when(repository.findAllByOrderByNameAsc()).thenReturn(List.of(expensiveApps, ftpFlows));
    when(graphService.getGraph(isNull(), any(), any(), any())).thenReturn(LIVE);
  }

  private static List<String> nodeIds(GraphResponseDto graph) {
    return graph.nodes().stream().map(GraphNodeDto::id).toList();
  }

  @Test
  void summarizesBreachesByApplicationAndByFlowWithTheRuleNames() {
    BreachSummaryResponse summary = service.summarize();

    assertThat(summary.applications()).containsOnlyKeys("billing");
    assertThat(summary.applications().get("billing")).containsExactly(expensiveApps.getId());
    assertThat(summary.flows()).containsOnlyKeys("crm-ledger");
    assertThat(summary.ruleNames())
        .containsEntry(expensiveApps.getId(), "Expensive apps")
        .containsEntry(ftpFlows.getId(), "FTP flows");
  }

  @Test
  void narrowsToTheSelectedRuleOnly() {
    GraphResponseDto narrowed = service.narrowToBreaches(LIVE, List.of(ftpFlows.getId().toString()));

    assertThat(nodeIds(narrowed)).containsExactly("crm", "ledger");
    assertThat(narrowed.edges()).extracting(GraphEdgeDto::id).containsExactly("crm-ledger");
  }

  @Test
  void anyRuleUnitesEveryRule() {
    GraphResponseDto narrowed = service.narrowToBreaches(LIVE, List.of(BreachRuleService.ANY_RULE));

    assertThat(nodeIds(narrowed)).containsExactly("billing", "crm", "ledger");
    assertThat(narrowed.edges()).extracting(GraphEdgeDto::id).containsExactly("crm-ledger");
  }

  /**
   * Regression: the saved copy returned by {@code merge} holds a lazy editor that cannot be read
   * once the repository call's session is closed ("Could not initialize proxy ... no session").
   */
  @Test
  void createdRuleNamesItsEditorWithoutReadingTheSavedCopysLazyEditor() {
    UserEntity admin = new UserEntity();
    admin.setUsername("admin");
    UserEntity detachedProxy = mock(UserEntity.class);
    when(detachedProxy.getUsername()).thenThrow(new LazyInitializationException("no session"));
    when(currentUserResolver.requireCurrentUser()).thenReturn(admin);
    when(dataModelService.loadConfig())
        .thenReturn(
            new DataModelConfig(
                List.of(
                    new DataModelField(
                        "cost", "Cost", "", "", List.of(), false, false, DataModelDetection.MANUAL, DataModelTarget.NODE, false))));
    when(repository.save(any()))
        .thenAnswer(
            invocation -> {
              BreachRuleEntity merged = new BreachRuleEntity(((BreachRuleEntity) invocation.getArgument(0)).getId());
              BreachRuleEntity submitted = invocation.getArgument(0);
              merged.setName(submitted.getName());
              merged.setSubject(submitted.getSubject());
              merged.setDefinition(submitted.getDefinition());
              merged.setUpdatedBy(detachedProxy);
              return merged;
            });

    BreachRuleResponse created =
        service.create(new BreachRuleRequest("Over budget", BreachSubject.APPLICATION, expensiveApps.getDefinition()));

    assertThat(created.updatedBy()).isEqualTo("admin");
    assertThat(created.breachCount()).isEqualTo(1);
  }

  @Test
  void rulesReadTheLiveGraphEvenWhenTheMapIsFiltered() {
    GraphResponseDto filtered = new GraphResponseDto(List.of(LIVE.nodes().get(1), LIVE.nodes().get(2)), List.of(LIVE.edges().get(0)));

    GraphResponseDto narrowed = service.narrowToBreaches(filtered, List.of(ftpFlows.getId().toString()));

    assertThat(narrowed.edges()).extracting(GraphEdgeDto::id).containsExactly("crm-ledger");
  }
}
