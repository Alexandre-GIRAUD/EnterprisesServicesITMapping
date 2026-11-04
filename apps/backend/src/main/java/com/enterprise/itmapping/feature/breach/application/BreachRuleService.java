package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.breach.domain.BreachRule;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.breach.infrastructure.persistence.BreachRuleEntity;
import com.enterprise.itmapping.feature.breach.infrastructure.persistence.BreachRuleRepository;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachRuleRequest;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachRuleResponse;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachSummaryResponse;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Shared breach rules: storage, and their evaluation over the live graph. */
@Service
public class BreachRuleService {

  /** Selector of {@code GET /graph?breach=} meaning every rule. */
  public static final String ANY_RULE = "any";

  private final BreachRuleRepository repository;
  private final BreachRuleValidator validator;
  private final BreachEvaluator evaluator;
  private final DataModelService dataModelService;
  private final GraphService graphService;
  private final CurrentUserResolver currentUserResolver;

  public BreachRuleService(
      BreachRuleRepository repository,
      BreachRuleValidator validator,
      BreachEvaluator evaluator,
      DataModelService dataModelService,
      GraphService graphService,
      CurrentUserResolver currentUserResolver) {
    this.repository = repository;
    this.validator = validator;
    this.evaluator = evaluator;
    this.dataModelService = dataModelService;
    this.graphService = graphService;
    this.currentUserResolver = currentUserResolver;
  }

  public List<BreachRuleResponse> list() {
    GraphResponseDto graph = loadLiveGraph();
    return repository.findAllByOrderByNameAsc().stream()
        .map(entity -> toResponse(entity, evaluator.evaluate(entity.toDomain(), graph)))
        .toList();
  }

  public BreachRuleResponse create(BreachRuleRequest request) {
    return save(new BreachRuleEntity(UUID.randomUUID()), request);
  }

  public BreachRuleResponse update(UUID id, BreachRuleRequest request) {
    return save(find(id), request);
  }

  public void delete(UUID id) {
    repository.delete(find(id));
  }

  public BreachResult evaluate(UUID id) {
    return evaluator.evaluate(find(id).toDomain(), loadLiveGraph());
  }

  /** For the map: the rules each element is in breach of, and the rule names to show. */
  public BreachSummaryResponse summarize() {
    List<BreachRule> rules = loadRules();
    Map<BreachSubject, Map<String, List<UUID>>> breaches = collectBreaches(rules, rule -> true);
    Map<UUID, String> ruleNames = new LinkedHashMap<>();
    rules.forEach(rule -> ruleNames.put(rule.id(), rule.name()));
    return new BreachSummaryResponse(
        breaches.get(BreachSubject.APPLICATION), breaches.get(BreachSubject.FLOW), ruleNames);
  }

  /**
   * Narrows a (possibly filtered) map graph to the breaches of the selected rules ({@link
   * #ANY_RULE} or rule ids). Rules read the whole live graph, so a filter never hides the
   * neighbour a cross condition needs.
   */
  public GraphResponseDto narrowToBreaches(GraphResponseDto graph, List<String> selectors) {
    Set<String> selected = Set.copyOf(selectors);
    boolean isEveryRuleSelected = selected.contains(ANY_RULE);
    Map<BreachSubject, Map<String, List<UUID>>> breaches =
        collectBreaches(loadRules(), rule -> isEveryRuleSelected || selected.contains(rule.id().toString()));
    return BreachGraphFilter.narrow(
        graph,
        breaches.get(BreachSubject.APPLICATION).keySet(),
        breaches.get(BreachSubject.FLOW).keySet());
  }

  List<BreachRule> loadRules() {
    return repository.findAllByOrderByNameAsc().stream().map(BreachRuleEntity::toDomain).toList();
  }

  GraphResponseDto loadLiveGraph() {
    return graphService.getGraph(null, Map.of(), Map.of(), Map.of());
  }

  /** Element id → ids of the matching rules in breach, per subject; both subjects are always present. */
  private Map<BreachSubject, Map<String, List<UUID>>> collectBreaches(
      List<BreachRule> rules, Predicate<BreachRule> isSelected) {
    GraphResponseDto graph = loadLiveGraph();
    Map<BreachSubject, Map<String, List<UUID>>> breaches = new EnumMap<>(BreachSubject.class);
    for (BreachSubject subject : BreachSubject.values()) {
      breaches.put(subject, new LinkedHashMap<>());
    }
    rules.stream()
        .filter(isSelected)
        .forEach(
            rule ->
                evaluator.evaluate(rule, graph).breaches().stream()
                    .map(BreachElement::id)
                    .forEach(
                        id -> breaches.get(rule.subject()).computeIfAbsent(id, key -> new ArrayList<>()).add(rule.id())));
    return breaches;
  }

  private BreachRuleResponse save(BreachRuleEntity entity, BreachRuleRequest request) {
    Set<String> otherNames =
        repository.findAll().stream()
            .filter(other -> !other.getId().equals(entity.getId()))
            .map(BreachRuleEntity::getName)
            .collect(Collectors.toSet());
    validator.validate(request, dataModelService.loadConfig(), otherNames);
    entity.setName(request.name().trim());
    entity.setSubject(request.subject());
    entity.setDefinition(request.definition());
    entity.setUpdatedBy(currentUserResolver.requireCurrentUser());
    BreachRuleEntity saved = repository.save(entity);
    return toResponse(saved, evaluator.evaluate(saved.toDomain(), loadLiveGraph()));
  }

  private BreachRuleEntity find(UUID id) {
    return repository
        .findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Breach rule not found."));
  }

  private static BreachRuleResponse toResponse(BreachRuleEntity entity, BreachResult result) {
    UserEntity updatedBy = entity.getUpdatedBy();
    return new BreachRuleResponse(
        entity.getId(),
        entity.getName(),
        entity.getSubject(),
        entity.getDefinition(),
        result.breaches().size(),
        result.unknown().size(),
        entity.getUpdatedAt(),
        updatedBy != null ? updatedBy.getUsername() : null);
  }
}
