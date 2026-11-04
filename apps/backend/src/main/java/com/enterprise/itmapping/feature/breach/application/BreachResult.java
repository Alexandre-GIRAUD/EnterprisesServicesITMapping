package com.enterprise.itmapping.feature.breach.application;

import java.util.List;

/** Elements in breach of one rule, and those the rule could not evaluate. */
public record BreachResult(List<BreachElement> breaches, List<BreachElement> unknown) {

  public BreachResult {
    breaches = List.copyOf(breaches);
    unknown = List.copyOf(unknown);
  }
}
