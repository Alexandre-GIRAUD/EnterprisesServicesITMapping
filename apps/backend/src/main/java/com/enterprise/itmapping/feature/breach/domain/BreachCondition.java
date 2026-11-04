package com.enterprise.itmapping.feature.breach.domain;

/** One test: the {@code attribute} of the element named by {@code scope}, against {@code value}. */
public record BreachCondition(
    BreachScope scope, String attribute, BreachOperator operator, String value) {

  public BreachCondition {
    attribute = attribute != null ? attribute.trim() : "";
    value = value != null ? value.trim() : "";
  }
}
