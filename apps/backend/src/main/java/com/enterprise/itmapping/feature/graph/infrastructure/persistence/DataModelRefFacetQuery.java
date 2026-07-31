package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/** Active {@code :DataModelRef} catalogue rows for one NODE_REF field key. */
@Repository
public class DataModelRefFacetQuery {

  private final Neo4jClient neo4jClient;

  public DataModelRefFacetQuery(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public List<RefOption> activeOptions(String fieldKey) {
    if (!StringUtils.hasText(fieldKey)) {
      return List.of();
    }
    return neo4jClient
        .query(
            """
            MATCH (r:DataModelRef {fieldKey: $fieldKey})
            WHERE coalesce(r.active, true) = true
            RETURN r.id AS id, r.name AS name, r.value AS value
            ORDER BY r.name
            """)
        .bind(fieldKey)
        .to("fieldKey")
        .fetch()
        .all()
        .stream()
        .map(
            row ->
                new RefOption(
                    asString(row.get("id")),
                    firstNonBlank(asString(row.get("name")), asString(row.get("value")))))
        .filter(o -> StringUtils.hasText(o.id()))
        .toList();
  }

  public record RefOption(String id, String name) {}

  private static String asString(Object value) {
    return value != null ? String.valueOf(value) : "";
  }

  private static String firstNonBlank(String a, String b) {
    if (StringUtils.hasText(a)) {
      return a;
    }
    return b != null ? b : "";
  }
}
