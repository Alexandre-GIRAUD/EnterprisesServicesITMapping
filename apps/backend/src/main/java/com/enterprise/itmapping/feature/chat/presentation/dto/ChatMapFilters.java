package com.enterprise.itmapping.feature.chat.presentation.dto;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Map filters the chat may read or apply. Same axes as the Filters drawer. */
public record ChatMapFilters(
    List<String> applicationIds,
    Map<String, List<String>> nodeAttributes,
    Map<String, List<String>> nodeRefs,
    Map<String, List<String>> edgeAttributes) {

  public ChatMapFilters {
    applicationIds = copyIds(applicationIds);
    nodeAttributes = copyAxis(nodeAttributes);
    nodeRefs = copyAxis(nodeRefs);
    edgeAttributes = copyAxis(edgeAttributes);
  }

  public static ChatMapFilters none() {
    return new ChatMapFilters(List.of(), Map.of(), Map.of(), Map.of());
  }

  private static List<String> copyIds(List<String> ids) {
    if (ids == null || ids.isEmpty()) {
      return List.of();
    }
    return List.copyOf(ids);
  }

  private static Map<String, List<String>> copyAxis(Map<String, List<String>> axis) {
    if (axis == null || axis.isEmpty()) {
      return Map.of();
    }
    Map<String, List<String>> copy = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> entry : axis.entrySet()) {
      if (entry.getKey() == null) {
        continue;
      }
      List<String> values = entry.getValue();
      copy.put(entry.getKey(), values == null ? List.of() : List.copyOf(values));
    }
    return Map.copyOf(copy);
  }
}
