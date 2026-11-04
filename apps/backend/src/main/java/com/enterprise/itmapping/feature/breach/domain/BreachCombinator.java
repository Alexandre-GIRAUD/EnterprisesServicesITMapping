package com.enterprise.itmapping.feature.breach.domain;

/** How sibling conditions, or sibling groups, are combined. */
public enum BreachCombinator {
  AND,
  OR;

  public Truth combine(Truth left, Truth right) {
    return this == AND ? left.and(right) : left.or(right);
  }

  /** The neutral start value of a fold: TRUE for AND, FALSE for OR. */
  public Truth identity() {
    return this == AND ? Truth.TRUE : Truth.FALSE;
  }
}
