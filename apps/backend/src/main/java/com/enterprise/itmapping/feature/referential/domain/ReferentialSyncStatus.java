package com.enterprise.itmapping.feature.referential.domain;

/** What a mechanical referential sync did with one Application attribute. */
public enum ReferentialSyncStatus {
  WRITTEN,
  UNCHANGED,
  MISSING,
  INVALID,
  BLOCKED
}
