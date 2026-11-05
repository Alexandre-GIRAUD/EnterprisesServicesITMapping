package com.enterprise.itmapping.feature.breach.presentation.dto;

import com.enterprise.itmapping.feature.breach.application.BreachElement;
import com.enterprise.itmapping.feature.breach.application.BreachResult;
import java.util.List;
import java.util.UUID;

/** {@code GET /breach-rules/{id}/evaluation}: what one rule flags, and what it cannot evaluate. */
public record BreachEvaluationResponse(UUID ruleId, List<BreachElement> breaches, List<BreachElement> unknown) {

  public static BreachEvaluationResponse of(UUID ruleId, BreachResult result) {
    return new BreachEvaluationResponse(ruleId, result.breaches(), result.unknown());
  }
}
