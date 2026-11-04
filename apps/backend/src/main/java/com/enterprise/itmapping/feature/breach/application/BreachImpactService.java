package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.breach.domain.BreachRule;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachImpact;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachImpactResponse;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemStatus;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionItemEntity;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionItemRepository;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Which breaches a pending Change item would create or resolve once accepted. */
@Service
public class BreachImpactService {

  private static final BreachImpactResponse NO_IMPACT = new BreachImpactResponse(List.of(), List.of());

  private final ChangeDetectionItemRepository itemRepository;
  private final BreachRuleService ruleService;
  private final BreachEvaluator evaluator;

  public BreachImpactService(
      ChangeDetectionItemRepository itemRepository,
      BreachRuleService ruleService,
      BreachEvaluator evaluator) {
    this.itemRepository = itemRepository;
    this.ruleService = ruleService;
    this.evaluator = evaluator;
  }

  @Transactional(readOnly = true)
  public BreachImpactResponse impact(UUID runId, UUID itemId) {
    ChangeDetectionItemEntity item =
        itemRepository
            .findByIdAndRun_Id(itemId, runId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found."));
    String applicationId = item.getRun().getApplicationId();
    if (item.getStatus() != ChangeDetectionItemStatus.PENDING || !StringUtils.hasText(applicationId)) {
      return NO_IMPACT;
    }
    GraphResponseDto before = ruleService.liveGraph();
    Map<String, Object> payload = item.getPayload() != null ? item.getPayload() : Map.of();
    GraphResponseDto after = BreachGraphChange.apply(before, applicationId, item.getKind(), payload);
    return diff(ruleService.rules(), before, after);
  }

  private BreachImpactResponse diff(List<BreachRule> rules, GraphResponseDto before, GraphResponseDto after) {
    List<BreachImpact> entering = new ArrayList<>();
    List<BreachImpact> leaving = new ArrayList<>();
    for (BreachRule rule : rules) {
      List<BreachElement> was = evaluator.evaluate(rule, before).breaches();
      List<BreachElement> willBe = evaluator.evaluate(rule, after).breaches();
      collectMissing(rule, willBe, ids(was), entering);
      collectMissing(rule, was, ids(willBe), leaving);
    }
    return new BreachImpactResponse(entering, leaving);
  }

  private static void collectMissing(
      BreachRule rule, List<BreachElement> elements, Set<String> otherIds, List<BreachImpact> out) {
    for (BreachElement element : elements) {
      if (!otherIds.contains(element.id())) {
        out.add(new BreachImpact(rule.id(), rule.name(), element));
      }
    }
  }

  private static Set<String> ids(List<BreachElement> elements) {
    return elements.stream().map(BreachElement::id).collect(Collectors.toSet());
  }
}
