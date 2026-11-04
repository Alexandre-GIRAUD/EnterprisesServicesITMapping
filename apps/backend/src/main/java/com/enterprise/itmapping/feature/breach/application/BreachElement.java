package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** An application or a flow listed under a rule. Source and target are set for a flow only. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record BreachElement(
    BreachSubject kind,
    String id,
    String label,
    String sourceId,
    String sourceLabel,
    String targetId,
    String targetLabel,
    List<BreachTestedValue> values) {

  public BreachElement {
    values = List.copyOf(values);
  }
}
