package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.breach.application.BreachGraphChange.PendingChange;
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
      ChangeDetectionItemRepository itemRepository, BreachRuleService ruleService, BreachEvaluator evaluator) {
    this.itemRepository = itemRepository;
    this.ruleService = ruleService;
    this.evaluator = evaluator;
  }

  @Transactional(readOnly = true)
  public BreachImpactResponse impact(UUID runId, UUID itemId) {
    ChangeDetectionItemEntity item =
        itemRepository
            .findByIdAndRun_Id(itemId, runId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Change item not found."));
    String applicationId = item.getRun().getApplicationId();
    if (item.getStatus() != ChangeDetectionItemStatus.PENDING || !StringUtils.hasText(applicationId)) {
      return NO_IMPACT;
    }
    Map<String, Object> payload = item.getPayload() != null ? item.getPayload() : Map.of();
    GraphResponseDto before = ruleService.loadLiveGraph();
    GraphResponseDto after =
        BreachGraphChange.apply(before, new PendingChange(applicationId, item.getKind(), payload));
    return compareBreaches(ruleService.loadRules(), before, after);
  }

  private BreachImpactResponse compareBreaches(
      List<BreachRule> rules, GraphResponseDto before, GraphResponseDto after) {
    List<BreachImpact> entering = new ArrayList<>();
    List<BreachImpact> leaving = new ArrayList<>();
    for (BreachRule rule : rules) {
      List<BreachElement> was = evaluator.evaluate(rule, before).breaches();
      List<BreachElement> willBe = evaluator.evaluate(rule, after).breaches();
      entering.addAll(findMissing(rule, willBe, was));
      leaving.addAll(findMissing(rule, was, willBe));
    }
    return new BreachImpactResponse(entering, leaving);
  }

  /** Elements of {@code elements} that {@code others} does not list, as impacts of {@code rule}. */
  private static List<BreachImpact> findMissing(
      BreachRule rule, List<BreachElement> elements, List<BreachElement> others) {
    Set<String> otherIds = others.stream().map(BreachElement::id).collect(Collectors.toSet());
    return elements.stream()
        .filter(element -> !otherIds.contains(element.id()))
        .map(element -> new BreachImpact(rule.id(), rule.name(), element))
        .toList();
  }
}
