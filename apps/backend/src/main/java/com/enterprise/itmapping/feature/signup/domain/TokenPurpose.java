package com.enterprise.itmapping.feature.signup.domain;

import java.time.Duration;

/** What an emailed account link does, and how long it stays valid. */
public enum TokenPurpose {
  VERIFY_EMAIL(Duration.ofHours(24)),
  RESET_PASSWORD(Duration.ofHours(1)),
  CHANGE_EMAIL(Duration.ofHours(24));

  private final Duration validity;

  TokenPurpose(Duration validity) {
    this.validity = validity;
  }

  public Duration validity() {
    return validity;
  }
}
