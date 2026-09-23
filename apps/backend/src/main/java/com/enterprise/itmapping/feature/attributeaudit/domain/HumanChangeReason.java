package com.enterprise.itmapping.feature.attributeaudit.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/** Reason required when a HUMAN edits an attribute. */
public enum HumanChangeReason {
  MissedOnScan,
  NotInSources,
  WrongData,
  WrongFormat,
  WrongSpelling,
  OutdatedData,
  Others;

  @JsonValue
  public String json() {
    return name();
  }

  @JsonCreator
  public static HumanChangeReason fromApi(String raw) {
    if (raw == null || raw.isBlank()) {
      return null;
    }
    String trimmed = raw.trim();
    for (HumanChangeReason reason : values()) {
      if (reason.name().equalsIgnoreCase(trimmed)) {
        return reason;
      }
    }
    String compact = trimmed.replace("_", "").replace("-", "").replace(" ", "").toLowerCase(Locale.ROOT);
    for (HumanChangeReason reason : values()) {
      if (reason.name().replace("_", "").equalsIgnoreCase(compact)) {
        return reason;
      }
    }
    throw new IllegalArgumentException("Unknown human change reason: " + raw);
  }
}
