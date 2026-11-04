package com.enterprise.itmapping.feature.breach.domain;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads numbers as people type them: {@code 120 000}, {@code 120k}, {@code 1,2M}. */
public final class BreachNumber {

  private static final Pattern NUMBER = Pattern.compile("(?<amount>-?\\d+(?:[.,]\\d+)?)(?<unit>[kKmM]?)");
  /** Thousands separators: any whitespace, including the no-break spaces a browser accepts as \s. */
  private static final Pattern SEPARATORS = Pattern.compile("[\\s\\u00A0\\u2007\\u202F]");
  private static final char DECIMAL_COMMA = ',';
  private static final char DECIMAL_POINT = '.';
  private static final Map<String, Double> UNIT_FACTORS = Map.of("", 1d, "k", 1_000d, "m", 1_000_000d);

  private BreachNumber() {}

  /** The value, or null when the text is not a number. */
  public static Double parse(String raw) {
    if (raw == null) {
      return null;
    }
    Matcher matcher = NUMBER.matcher(SEPARATORS.matcher(raw).replaceAll(""));
    if (!matcher.matches()) {
      return null;
    }
    double amount = Double.parseDouble(matcher.group("amount").replace(DECIMAL_COMMA, DECIMAL_POINT));
    return amount * UNIT_FACTORS.get(matcher.group("unit").toLowerCase());
  }
}
