package com.enterprise.itmapping.feature.graphsnapshot.application;

import java.util.function.Predicate;

/** Name of a one-time copy on the recipient's root. */
public final class ShareCopyNames {

  public static final int MAX_NAME_LENGTH = 80;
  private static final int MAX_ATTEMPTS = 50;

  private ShareCopyNames() {}

  public static String choose(String original, String senderUsername, Predicate<String> isTaken) {
    if (!isTaken.test(original)) {
      return original;
    }
    String from = " (from " + senderUsername.trim() + ")";
    for (int number = 1; number <= MAX_ATTEMPTS; number++) {
      String tail = number == 1 ? from : from + " " + number;
      String candidate = fit(original, tail);
      if (!isTaken.test(candidate)) {
        return candidate;
      }
    }
    throw new IllegalStateException("No free name for the copy.");
  }

  private static String fit(String original, String tail) {
    int room = MAX_NAME_LENGTH - tail.length();
    if (room < 1) {
      return tail.substring(tail.length() - MAX_NAME_LENGTH);
    }
    String base = original.length() <= room ? original : original.substring(0, room).trim();
    if (base.isEmpty()) {
      base = original.substring(0, 1);
    }
    return base + tail;
  }
}
