package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** An application or a flow listed under a rule. A flow also names its source and target. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record BreachElement(
    BreachSubject kind,
    String id,
    String label,
    BreachEndpoint source,
    BreachEndpoint target,
    List<BreachTestedValue> values) {

  private static final String FLOW_ARROW = " → ";

  public BreachElement {
    values = List.copyOf(values);
  }

  public static BreachElement ofApplication(String id, String label, List<BreachTestedValue> values) {
    return new BreachElement(BreachSubject.APPLICATION, id, label, null, null, values);
  }

  /** Both endpoints travel together, so a flow takes them as one pair. */
  public static BreachElement ofFlow(String id, FlowEnds ends, List<BreachTestedValue> values) {
    String label = ends.source().label() + FLOW_ARROW + ends.target().label();
    return new BreachElement(BreachSubject.FLOW, id, label, ends.source(), ends.target(), values);
  }

  /** Source and target of one flow. */
  public record FlowEnds(BreachEndpoint source, BreachEndpoint target) {}
}
