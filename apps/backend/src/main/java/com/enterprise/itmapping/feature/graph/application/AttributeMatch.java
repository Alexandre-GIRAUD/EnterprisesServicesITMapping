package com.enterprise.itmapping.feature.graph.application;

import java.util.ArrayList;
import java.util.List;

/**
 * A filter value of {@link #EMPTY} matches an application or flow whose Data Model field is missing
 * or blank. Real values stay an IN-list. Keys passed here are already Data Model keys.
 */
public final class AttributeMatch {

  public static final String EMPTY = "__empty__";

  public record Split(List<String> values, boolean shouldIncludeEmpty) {}

  private AttributeMatch() {}

  public static Split split(List<String> raw) {
    List<String> values = new ArrayList<>();
    boolean shouldIncludeEmpty = false;
    if (raw != null) {
      for (String value : raw) {
        if (EMPTY.equals(value)) {
          shouldIncludeEmpty = true;
        } else if (value != null) {
          values.add(value);
        }
      }
    }
    return new Split(List.copyOf(values), shouldIncludeEmpty);
  }

  /** One property comparison: node or relationship alias, field key, and the bound parameter name. */
  public record Clause(String alias, String fieldKey, String parameterName, Split split) {}

  /** Cypher fragment starting with AND. {@code alias} is {@code a} or {@code r}. */
  public static String buildCypher(Clause clause) {
    String property = clause.alias() + ".`" + clause.fieldKey() + "`";
    String blank = "(" + property + " IS NULL OR trim(toString(" + property + ")) = '')";
    String listed = "toString(" + property + ") IN $" + clause.parameterName();
    Split split = clause.split();
    if (split.shouldIncludeEmpty() && !split.values().isEmpty()) {
      return "  AND (" + listed + " OR " + blank + ")\n";
    }
    if (split.shouldIncludeEmpty()) {
      return "  AND " + blank + "\n";
    }
    return "  AND " + listed + "\n";
  }
}
