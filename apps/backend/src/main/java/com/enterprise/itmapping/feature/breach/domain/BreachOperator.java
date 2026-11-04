package com.enterprise.itmapping.feature.breach.domain;

/** Comparison of a condition. Numeric operators read both sides with {@link BreachNumber}. */
public enum BreachOperator {
  EQUALS,
  NOT_EQUALS,
  GREATER_THAN,
  GREATER_OR_EQUAL,
  LESS_THAN,
  LESS_OR_EQUAL,
  CONTAINS,
  IS_EMPTY,
  IS_NOT_EMPTY;

  public boolean needsValue() {
    return this != IS_EMPTY && this != IS_NOT_EMPTY;
  }

  public boolean isNumeric() {
    return this == GREATER_THAN
        || this == GREATER_OR_EQUAL
        || this == LESS_THAN
        || this == LESS_OR_EQUAL;
  }

  /** Numeric operators only. */
  public boolean compare(double actual, double expected) {
    return switch (this) {
      case GREATER_THAN -> actual > expected;
      case GREATER_OR_EQUAL -> actual >= expected;
      case LESS_THAN -> actual < expected;
      case LESS_OR_EQUAL -> actual <= expected;
      default -> throw new IllegalStateException(this + " is not a numeric operator");
    };
  }
}
