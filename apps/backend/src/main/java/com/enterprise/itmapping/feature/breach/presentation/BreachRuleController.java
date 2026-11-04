package com.enterprise.itmapping.feature.breach.presentation;

import com.enterprise.itmapping.feature.breach.application.BreachRuleService;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachEvaluationResponse;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachRuleRequest;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachRuleResponse;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachSummaryResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/breach-rules")
public class BreachRuleController {

  private final BreachRuleService breachRuleService;

  public BreachRuleController(BreachRuleService breachRuleService) {
    this.breachRuleService = breachRuleService;
  }

  @GetMapping
  public List<BreachRuleResponse> list() {
    return breachRuleService.list();
  }

  @PostMapping
  @PreAuthorize("hasRole('ADMIN')")
  @ResponseStatus(HttpStatus.CREATED)
  public BreachRuleResponse create(@RequestBody BreachRuleRequest request) {
    return breachRuleService.create(request);
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public BreachRuleResponse update(@PathVariable UUID id, @RequestBody BreachRuleRequest request) {
    return breachRuleService.update(id, request);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    breachRuleService.delete(id);
  }

  /** Breaches of every rule, by application and by flow, for the map. */
  @GetMapping("/evaluation")
  public BreachSummaryResponse summarize() {
    return breachRuleService.summarize();
  }

  @GetMapping("/{id}/evaluation")
  public BreachEvaluationResponse evaluate(@PathVariable UUID id) {
    return BreachEvaluationResponse.of(id, breachRuleService.evaluate(id));
  }
}
