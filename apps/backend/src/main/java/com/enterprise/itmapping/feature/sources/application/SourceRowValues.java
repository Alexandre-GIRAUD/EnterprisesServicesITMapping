package com.enterprise.itmapping.feature.sources.application;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Reads rows returned by a source. */
public final class SourceRowValues {

  private SourceRowValues() {}

  /** The row whose key column equals the key (case-insensitive), or an empty map. */
  public static Map<String, Object> findRow(
      List<Map<String, Object>> rows, String keyColumn, String key) {
    if (keyColumn == null || key == null) {
      return Map.of();
    }
    return rows.stream()
        .filter(row -> row.get(keyColumn) != null)
        .filter(row -> String.valueOf(row.get(keyColumn)).equalsIgnoreCase(key))
        .findFirst()
        .orElse(Map.of());
  }

  /** Data Model field key to value, for mapped columns present in the row. */
  public static Map<String, Object> extract(
      Map<String, Object> row, Map<String, String> columnMap) {
    Map<String, Object> values = new LinkedHashMap<>();
    columnMap.forEach(
        (fieldKey, column) -> {
          Object value = row.get(column);
          if (value != null) {
            values.put(fieldKey, value);
          }
        });
    return values;
  }
}
