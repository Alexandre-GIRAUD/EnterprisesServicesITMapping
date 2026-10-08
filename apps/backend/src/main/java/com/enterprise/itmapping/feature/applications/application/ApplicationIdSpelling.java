package com.enterprise.itmapping.feature.applications.application;

/** Collapses spaces and underscores so {@code app_1}, {@code app 1}, and {@code app1} compare equal. */
public final class ApplicationIdSpelling {

  private ApplicationIdSpelling() {}

  public static String compact(String value) {
    if (value == null) {
      return "";
    }
    StringBuilder compact = new StringBuilder();
    for (int i = 0; i < value.length(); i++) {
      char character = value.charAt(i);
      if (character == ' ' || character == '_') {
        continue;
      }
      compact.append(Character.toLowerCase(character));
    }
    return compact.toString();
  }
}
