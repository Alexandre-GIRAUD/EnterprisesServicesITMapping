package com.enterprise.itmapping.feature.breach.domain;

import java.util.List;

/** The condition tree of a rule: groups joined by one combinator. Stored as JSON. */
public record BreachDefinition(BreachCombinator combinator, List<BreachGroup> groups) {

  public BreachDefinition {
    groups = groups != null ? List.copyOf(groups) : List.of();
  }
}
