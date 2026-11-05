package com.enterprise.itmapping.feature.breach.domain;

/** Three-valued (Kleene) logic: UNKNOWN stands for a missing or unreadable value. */
public enum Truth {
  TRUE,
  FALSE,
  UNKNOWN;

  public static Truth of(boolean value) {
    return value ? TRUE : FALSE;
  }

  public Truth and(Truth other) {
    if (this == FALSE || other == FALSE) {
      return FALSE;
    }
    return this == UNKNOWN || other == UNKNOWN ? UNKNOWN : TRUE;
  }

  public Truth or(Truth other) {
    if (this == TRUE || other == TRUE) {
      return TRUE;
    }
    return this == UNKNOWN || other == UNKNOWN ? UNKNOWN : FALSE;
  }
}
