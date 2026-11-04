package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
    GraphResponseDto graph = liveGraph();
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
    return evaluator.evaluate(find(id).toDomain(), liveGraph());
  }

  public BreachSummaryResponse summary() {
    GraphResponseDto graph = liveGraph();
    Map<String, List<UUID>> applications = new LinkedHashMap<>();
    Map<String, List<UUID>> flows = new LinkedHashMap<>();
    for (BreachRule rule : rules()) {
      Map<String, List<UUID>> target = rule.subject() == BreachSubject.APPLICATION ? applications : flows;
      for (BreachElement element : evaluator.evaluate(rule, graph).breaches()) {
        target.computeIfAbsent(element.id(), id -> new ArrayList<>()).add(rule.id());
      }
    }
    return new BreachSummaryResponse(applications, flows);
  }

  /**
   * Narrows a (possibly filtered) map graph to the breaches of the selected rules ({@link
   * #ANY_RULE} or rule ids). Rules read the whole live graph, so a filter never hides the
   * neighbour a cross condition needs.
   */
  public GraphResponseDto narrowToBreaches(GraphResponseDto graph, List<String> selectors) {
    Set<String> selected = new HashSet<>(selectors);
    boolean everyRule = selected.contains(ANY_RULE);
    GraphResponseDto live = liveGraph();
    Set<String> applicationIds = new HashSet<>();
    Set<String> flowIds = new HashSet<>();
    for (BreachRule rule : rules()) {
      if (!everyRule && !selected.contains(rule.id().toString())) {
        continue;
      }
      Set<String> target = rule.subject() == BreachSubject.APPLICATION ? applicationIds : flowIds;
      evaluator.evaluate(rule, live).breaches().forEach(element -> target.add(element.id()));
    }
    return BreachGraphFilter.narrow(graph, applicationIds, flowIds);
  }

  List<BreachRule> rules() {
    return repository.findAllByOrderByNameAsc().stream().map(BreachRuleEntity::toDomain).toList();
  }

  GraphResponseDto liveGraph() {
    return graphService.getGraph(null, Map.of(), Map.of(), Map.of());
  }

  private BreachRuleResponse save(BreachRuleEntity entity, BreachRuleRequest request) {
    Set<String> otherNames =
        repository.findAll().stream()
            .filter(other -> !other.getId().equals(entity.getId()))
            .map(BreachRuleEntity::getName)
            .collect(Collectors.toSet());
    validator.validate(
        request.name(), request.subject(), request.definition(), dataModelService.loadConfig(), otherNames);
    entity.setName(request.name().trim());
    entity.setSubject(request.subject());
    entity.setDefinition(request.definition());
    entity.setUpdatedBy(currentUserResolver.requireCurrentUser());
    BreachRuleEntity saved = repository.save(entity);
    return toResponse(saved, evaluator.evaluate(saved.toDomain(), liveGraph()));
  }

  private BreachRuleEntity find(UUID id) {
    return repository
        .findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Breach rule not found."));
  }

  private static BreachRuleResponse toResponse(BreachRuleEntity entity, BreachResult result) {
    return new BreachRuleResponse(
        entity.getId(),
        entity.getName(),
        entity.getSubject(),
        entity.getDefinition(),
        result.breaches().size(),
        result.unknown().size(),
        entity.getUpdatedAt());
  }
}
