package com.enterprise.itmapping.feature.graph.application;

import java.util.ArrayList;
import java.util.List;

/**
 * A filter value of {@link #EMPTY} matches an application or flow whose Data Model field is missing
 * or blank. Real values stay an IN-list. Keys passed here are already Data Model keys.
 */
public final class AttributeMatch {

  public static final String EMPTY = "__empty__";

  public record Split(List<String> values, boolean includeEmpty) {}

  private AttributeMatch() {}

  public static Split split(List<String> raw) {
    List<String> values = new ArrayList<>();
    boolean includeEmpty = false;
    if (raw != null) {
      for (String value : raw) {
        if (EMPTY.equals(value)) {
          includeEmpty = true;
        } else if (value != null) {
          values.add(value);
        }
      }
    }
    return new Split(List.copyOf(values), includeEmpty);
  }

  /** Cypher fragment starting with AND. {@code alias} is {@code a} or {@code r}. */
  public static String cypher(String alias, String key, String param, Split split) {
    String property = alias + ".`" + key + "`";
    String blank = "(" + property + " IS NULL OR trim(toString(" + property + ")) = '')";
    String listed = "toString(" + property + ") IN $" + param;
    if (split.includeEmpty() && !split.values().isEmpty()) {
      return "  AND (" + listed + " OR " + blank + ")\n";
    }
    if (split.includeEmpty()) {
      return "  AND " + blank + "\n";
    }
    return "  AND " + listed + "\n";
  }
}
