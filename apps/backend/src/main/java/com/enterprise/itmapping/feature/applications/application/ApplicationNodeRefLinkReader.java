package com.enterprise.itmapping.feature.applications.application;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Reads {@code CLASSIFIED_AS} catalogue links for an Application. */
@Component
public class ApplicationNodeRefLinkReader {

  private final Neo4jClient neo4jClient;

  public ApplicationNodeRefLinkReader(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  /**
   * @return fieldKey → linked refs (id + name + value), ordered by name
   */
  public Map<String, List<RefSummary>> read(String applicationId) {
    if (!StringUtils.hasText(applicationId)) {
      return Map.of();
    }
    Map<String, List<RefSummary>> out = new LinkedHashMap<>();
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $id})-[rel:CLASSIFIED_AS]->(r:DataModelRef)
            RETURN rel.fieldKey AS fieldKey, r.id AS id, r.name AS name, r.value AS value
            ORDER BY rel.fieldKey, r.name
            """)
        .bind(applicationId)
        .to("id")
        .fetch()
        .all()
        .forEach(
            row -> {
              String fieldKey = asString(row.get("fieldKey"));
              String id = asString(row.get("id"));
              if (!StringUtils.hasText(fieldKey) || !StringUtils.hasText(id)) {
                return;
              }
              out.computeIfAbsent(fieldKey, k -> new ArrayList<>())
                  .add(
                      new RefSummary(
                          id, asString(row.get("name")), asString(row.get("value"))));
            });
    Map<String, List<RefSummary>> copy = new LinkedHashMap<>();
    for (Map.Entry<String, List<RefSummary>> e : out.entrySet()) {
      copy.put(e.getKey(), List.copyOf(e.getValue()));
    }
    return Map.copyOf(copy);
  }

  public record RefSummary(String id, String name, String value) {}

  private static String asString(Object value) {
    return value != null ? String.valueOf(value) : "";
  }
}
