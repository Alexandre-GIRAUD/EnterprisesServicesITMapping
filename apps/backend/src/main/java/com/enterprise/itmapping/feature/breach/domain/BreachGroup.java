package com.enterprise.itmapping.feature.breach.domain;

import java.util.List;

/** Conditions joined by one combinator. */
public record BreachGroup(BreachCombinator combinator, List<BreachCondition> conditions) {

  public BreachGroup {
    conditions = conditions != null ? List.copyOf(conditions) : List.of();
  }
}
