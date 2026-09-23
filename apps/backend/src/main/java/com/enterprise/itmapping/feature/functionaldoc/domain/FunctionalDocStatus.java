package com.enterprise.itmapping.feature.functionaldoc.domain;

/** Lifecycle of an application's functional documentation. {@code MISSING} is API-only (no row). */
public enum FunctionalDocStatus {
  MISSING,
  PENDING,
  READY,
  FAILED
}
