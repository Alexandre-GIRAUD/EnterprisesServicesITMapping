package com.enterprise.itmapping.feature.breach.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.breach.domain.BreachCombinator;
import com.enterprise.itmapping.feature.breach.domain.BreachCondition;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachGroup;
import com.enterprise.itmapping.feature.breach.domain.BreachOperator;
import com.enterprise.itmapping.feature.breach.domain.BreachRule;
import com.enterprise.itmapping.feature.breach.domain.BreachScope;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachImpact;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachImpactResponse;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemKind;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemStatus;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionItemEntity;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionItemRepository;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionRunEntity;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class BreachImpactServiceTest {

  private static final UUID RUN_ID = UUID.randomUUID();
  private static final UUID ITEM_ID = UUID.randomUUID();

  private static final BreachRule EXPENSIVE_APPS =
      single("Expensive apps", BreachSubject.APPLICATION, BreachScope.SELF, "cost", "100k");
  private static final BreachRule FLOWS_FROM_EXPENSIVE_APPS =
      single("Flows from expensive apps", BreachSubject.FLOW, BreachScope.SOURCE, "cost", "100k");

  private static final GraphResponseDto LIVE =
      new GraphResponseDto(
          List.of(
              new GraphNodeDto("billing", "Billing", "Application", null, Map.of("cost", "200k")),
              new GraphNodeDto("crm", "CRM", "Application", null, Map.of("cost", "5k"))),
          List.of(new GraphEdgeDto("crm-billing", "crm", "billing", "DEPENDS_ON", null, Map.of())));

  private final ChangeDetectionItemRepository itemRepository = mock(ChangeDetectionItemRepository.class);
  private final BreachRuleService ruleService = mock(BreachRuleService.class);
  private final BreachImpactService service =
      new BreachImpactService(itemRepository, ruleService, new BreachEvaluator());

  private static BreachRule single(
      String name, BreachSubject subject, BreachScope scope, String attribute, String threshold) {
    BreachCondition condition = new BreachCondition(scope, attribute, BreachOperator.GREATER_THAN, threshold);
    return new BreachRule(
        UUID.randomUUID(),
        name,
        subject,
        new BreachDefinition(
            BreachCombinator.AND, List.of(new BreachGroup(BreachCombinator.AND, List.of(condition)))));
  }

  private void pendingItem(ChangeDetectionItemKind kind, Map<String, Object> payload, ChangeDetectionItemStatus status) {
    ChangeDetectionRunEntity run = new ChangeDetectionRunEntity();
    run.setApplicationId("crm");
    ChangeDetectionItemEntity item = new ChangeDetectionItemEntity();
    item.setRun(run);
    item.setKind(kind);
    item.setStatus(status);
    item.setPayload(payload);
    when(itemRepository.findByIdAndRun_Id(ITEM_ID, RUN_ID)).thenReturn(Optional.of(item));
  }

  private static List<String> describe(List<BreachImpact> impacts) {
    return impacts.stream().map(impact -> impact.ruleName() + ":" + impact.element().id()).toList();
  }

  @BeforeEach
  void liveGraphWithTwoRules() {
    when(ruleService.loadLiveGraph()).thenReturn(LIVE);
    when(ruleService.loadRules()).thenReturn(List.of(EXPENSIVE_APPS, FLOWS_FROM_EXPENSIVE_APPS));
  }

  @Test
  void aRaisedCostPutsTheApplicationAndItsOutgoingFlowsInBreach() {
    pendingItem(
        ChangeDetectionItemKind.NODE_ATTRIBUTE,
        Map.of("key", "cost", "value", "300k"),
        ChangeDetectionItemStatus.PENDING);

    BreachImpactResponse impact = service.impact(RUN_ID, ITEM_ID);

    assertThat(describe(impact.entering()))
        .containsExactly("Expensive apps:crm", "Flows from expensive apps:crm-billing");
    assertThat(impact.leaving()).isEmpty();
  }

  @Test
  void aLoweredCostTakesTheApplicationOutOfBreach() {
    when(ruleService.loadLiveGraph())
        .thenReturn(
            new GraphResponseDto(
                List.of(new GraphNodeDto("crm", "CRM", "Application", null, Map.of("cost", "500k"))), List.of()));
    pendingItem(
        ChangeDetectionItemKind.NODE_ATTRIBUTE, Map.of("key", "cost", "value", "1k"), ChangeDetectionItemStatus.PENDING);

    BreachImpactResponse impact = service.impact(RUN_ID, ITEM_ID);

    assertThat(impact.entering()).isEmpty();
    assertThat(describe(impact.leaving())).containsExactly("Expensive apps:crm");
  }

  @Test
  void aReviewedItemHasNoImpact() {
    pendingItem(
        ChangeDetectionItemKind.NODE_ATTRIBUTE,
        Map.of("key", "cost", "value", "300k"),
        ChangeDetectionItemStatus.ACCEPTED);

    BreachImpactResponse impact = service.impact(RUN_ID, ITEM_ID);

    assertThat(impact.entering()).isEmpty();
    assertThat(impact.leaving()).isEmpty();
  }
}
