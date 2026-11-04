package com.enterprise.itmapping.feature.breach.domain;

/** Which element a condition reads, relative to the rule subject. */
public enum BreachScope {
  /** The application itself. */
  SELF(BreachSubject.APPLICATION, false),
  /** At least one flow arriving at the application. */
  ANY_FLOW_IN(BreachSubject.APPLICATION, true),
  /** At least one flow leaving the application. */
  ANY_FLOW_OUT(BreachSubject.APPLICATION, true),
  /** At least one flow touching the application. */
  ANY_FLOW(BreachSubject.APPLICATION, true),
  /** The flow itself. */
  FLOW(BreachSubject.FLOW, true),
  /** The application the flow leaves. */
  SOURCE(BreachSubject.FLOW, false),
  /** The application the flow reaches. */
  TARGET(BreachSubject.FLOW, false),
  /** True when the source or the target matches. */
  SOURCE_OR_TARGET(BreachSubject.FLOW, false);

  private final BreachSubject subject;
  private final boolean readsFlowAttributes;

  BreachScope(BreachSubject subject, boolean readsFlowAttributes) {
    this.subject = subject;
    this.readsFlowAttributes = readsFlowAttributes;
  }

  public boolean fits(BreachSubject ruleSubject) {
    return subject == ruleSubject;
  }

  /** True when the condition attribute is a flow (EDGE) attribute, false for an application one. */
  public boolean readsFlowAttributes() {
    return readsFlowAttributes;
  }
}
