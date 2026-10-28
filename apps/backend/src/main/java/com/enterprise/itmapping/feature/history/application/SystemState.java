package com.enterprise.itmapping.feature.history.application;

import java.util.List;
import java.util.Map;

/** Applications, modules and the relationships leaving them, with all their Neo4j properties. */
public record SystemState(
    List<Map<String, Object>> applications,
    List<Map<String, Object>> modules,
    List<Relationship> relationships) {

  public record Relationship(
      String type,
      String sourceLabel,
      String targetLabel,
      String sourceId,
      String targetId,
      Map<String, Object> properties) {}
}
