package com.enterprise.itmapping.feature.auth.domain;

/** A self-registered account stays PENDING until its email is confirmed. */
public enum UserStatus {
  ACTIVE,
  PENDING
}
