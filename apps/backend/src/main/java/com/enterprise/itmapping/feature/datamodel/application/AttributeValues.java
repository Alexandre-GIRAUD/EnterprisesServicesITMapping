package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Reads and normalizes a Data Model attribute that is either one string or a list of strings.
 */
public final class AttributeValues {

  public static final String SEPARATOR = ", ";

  private AttributeValues() {}

  /** A string is one value. A list is its values. Blank entries are dropped. */
  public static List<String> coerce(Object raw) {
    if (raw == null) {
      return List.of();
    }
    if (raw instanceof String text) {
      String trimmed = text.trim();
      return trimmed.isEmpty() ? List.of() : List.of(trimmed);
    }
    if (raw instanceof Collection<?> collection) {
      List<String> values = new ArrayList<>();
      for (Object item : collection) {
        if (item == null) {
          continue;
        }
        String trimmed = String.valueOf(item).trim();
        if (!trimmed.isEmpty()) {
          values.add(trimmed);
        }
      }
      return values;
    }
    String trimmed = String.valueOf(raw).trim();
    return trimmed.isEmpty() ? List.of() : List.of(trimmed);
  }

  /** Full list, in order, for history rows and table cells. */
  public static String display(Object raw) {
    return String.join(SEPARATOR, coerce(raw));
  }

  public static boolean containsIgnoreCase(List<String> values, String candidate) {
    if (candidate == null) {
      return false;
    }
    String needle = candidate.trim().toLowerCase(Locale.ROOT);
    for (String value : values) {
      if (value != null && value.toLowerCase(Locale.ROOT).equals(needle)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Catalogue spelling when the value is allowed. Comparison ignores case.
   *
   * @return the catalogue text, or null when the value is not in the list
   */
  public static String matchAllowed(String value, List<String> allowedValues) {
    if (value == null || allowedValues == null) {
      return null;
    }
    for (String allowed : allowedValues) {
      if (allowed.equalsIgnoreCase(value.trim())) {
        return allowed;
      }
    }
    return null;
  }

  /**
   * Pipeline parse. Invalid catalogue entries are dropped. A single-value field keeps the first
   * valid entry. {@code rejectedLiteral} is set only when a single-value enum had input and none
   * of it was valid — the caller then fails the whole write, as it does today.
   */
  public static Parsed parse(DataModelField field, Object raw) {
    List<String> incoming = coerce(raw);
    boolean strict =
        field.enforceEnum() && field.allowedValues() != null && !field.allowedValues().isEmpty();
    List<String> matched = new ArrayList<>();
    Set<String> seen = new LinkedHashSet<>();
    String rejected = null;
    for (String value : incoming) {
      String stored = value;
      if (strict) {
        stored = matchAllowed(value, field.allowedValues());
        if (stored == null) {
          if (!field.multiple() && rejected == null) {
            rejected = value;
          }
          continue;
        }
      }
      if (seen.add(stored.toLowerCase(Locale.ROOT))) {
        matched.add(stored);
      }
      if (!field.multiple()) {
        return new Parsed(List.copyOf(matched), null);
      }
    }
    if (!field.multiple() && matched.isEmpty() && rejected != null) {
      return new Parsed(List.of(), rejected);
    }
    return new Parsed(List.copyOf(matched), null);
  }

  /** String property when the field is single-value. List property when it allows several. */
  public static Object stored(boolean multiple, List<String> values) {
    if (values == null || values.isEmpty()) {
      return null;
    }
    if (!multiple) {
      return values.getFirst();
    }
    return List.copyOf(values);
  }

  /** Keeps a stored string as a string and a stored list as a list. */
  public static Map<String, Object> readProperties(Object raw, Set<String> excludedKeys) {
    if (!(raw instanceof Map<?, ?> map)) {
      return Map.of();
    }
    Map<String, Object> out = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      String key = String.valueOf(entry.getKey());
      Object value = entry.getValue();
      if (excludedKeys.contains(key) || value == null) {
        continue;
      }
      if (value instanceof Collection<?> || value.getClass().isArray()) {
        List<String> items = coerce(value);
        if (!items.isEmpty()) {
          out.put(key, List.copyOf(items));
        }
        continue;
      }
      String text = String.valueOf(value).trim();
      if (!text.isEmpty()) {
        out.put(key, text);
      }
    }
    return Map.copyOf(out);
  }

  /** Whitelisted properties ready for {@code SET n += $dynamicProps}. */
  public static Map<String, Object> whitelisted(Map<String, ?> raw, Set<String> allowedKeys) {
    if (raw == null || raw.isEmpty() || allowedKeys == null || allowedKeys.isEmpty()) {
      return Map.of();
    }
    Map<String, Object> out = new LinkedHashMap<>();
    for (Map.Entry<String, ?> entry : raw.entrySet()) {
      String key = entry.getKey();
      if (key == null || !allowedKeys.contains(key)) {
        continue;
      }
      Object value = entry.getValue();
      if (value instanceof String text) {
        String trimmed = text.trim();
        if (!trimmed.isEmpty()) {
          out.put(key, trimmed);
        }
        continue;
      }
      if (value instanceof Collection<?>) {
        List<String> items = coerce(value);
        if (!items.isEmpty()) {
          out.put(key, items);
        }
      }
    }
    return out;
  }

  public record Parsed(List<String> values, String rejectedLiteral) {}
}
