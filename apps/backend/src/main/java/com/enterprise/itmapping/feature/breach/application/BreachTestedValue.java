package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.breach.domain.BreachScope;
import java.util.List;

/** The values a rule read for one scope and attribute, so a result row shows why it is listed. */
public record BreachTestedValue(BreachScope scope, String attribute, List<String> values) {

  public BreachTestedValue {
    values = List.copyOf(values);
  }
}
