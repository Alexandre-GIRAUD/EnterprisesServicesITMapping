package com.enterprise.itmapping.feature.breach.domain;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads numbers as people type them: {@code 120 000}, {@code 120k}, {@code 1,2M}. */
public final class BreachNumber {

  private static final Pattern NUMBER = Pattern.compile("(-?\\d+(?:[.,]\\d+)?)([kKmM]?)");
  private static final double THOUSAND = 1_000d;
  private static final double MILLION = 1_000_000d;

  private BreachNumber() {}

  /** The value, or null when the text is not a number. */
  public static Double parse(String raw) {
    if (raw == null) {
      return null;
    }
    Matcher matcher = NUMBER.matcher(raw.replaceAll("\\s", ""));
    if (!matcher.matches()) {
      return null;
    }
    double value = Double.parseDouble(matcher.group(1).replace(',', '.'));
    return switch (matcher.group(2).toLowerCase()) {
      case "k" -> value * THOUSAND;
      case "m" -> value * MILLION;
      default -> value;
    };
  }
}
