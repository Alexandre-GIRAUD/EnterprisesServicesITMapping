package com.enterprise.itmapping.feature.sources.application;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Applications that still need a mapping decision, per source in use. */
public final class SourceMappingAlerts {

  private SourceMappingAlerts() {}

  /**
   * @param usedSourceIds sources feeding at least one Data Model attribute
   * @param applicationIds every application
   * @param decidedBySource application ids with a mapping row (a key or no match) per source
   * @return source id to the applications without a decision; fully decided sources are omitted
   */
  public static Map<String, List<String>> compute(
      Set<String> usedSourceIds,
      List<String> applicationIds,
      Map<String, Set<String>> decidedBySource) {
    Map<String, List<String>> alerts = new LinkedHashMap<>();
    for (String sourceId : usedSourceIds) {
      Set<String> decided = decidedBySource.getOrDefault(sourceId, Set.of());
      List<String> pending = applicationIds.stream().filter(id -> !decided.contains(id)).toList();
      if (!pending.isEmpty()) {
        alerts.put(sourceId, pending);
      }
    }
    return alerts;
  }
}
