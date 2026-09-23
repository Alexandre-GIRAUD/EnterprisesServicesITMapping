package com.enterprise.itmapping.feature.graph.application;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Reads dynamic business properties stored on a {@code DEPENDS_ON} relationship. */
@Component
public class GraphEdgeAttributeReader {

  /** System / structural keys never treated as Data Model EDGE attributes. */
  static final Set<String> NON_BUSINESS_KEYS =
      Set.of(
          "id",
          "data",
          "connection_kind",
          "channel",
          "direction",
          "confidence",
          "discovered_from_application_id",
          "validFrom",
          "validTo");

  private final Neo4jClient neo4jClient;

  public GraphEdgeAttributeReader(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public boolean exists(String edgeId) {
    if (!StringUtils.hasText(edgeId)) {
      return false;
    }
    return neo4jClient
        .query(
            """
            MATCH ()-[r:DEPENDS_ON {id: $id}]->()
            RETURN count(r) AS cnt
            """)
        .bind(edgeId.trim())
        .to("id")
        .fetch()
        .first()
        .map(
            row -> {
              Object cnt = row.get("cnt");
              return cnt instanceof Number n && n.longValue() > 0;
            })
        .orElse(false);
  }

  public Map<String, String> read(String edgeId) {
    if (!StringUtils.hasText(edgeId)) {
      return Map.of();
    }
    return neo4jClient
        .query(
            """
            MATCH ()-[r:DEPENDS_ON {id: $id}]->()
            RETURN properties(r) AS props
            LIMIT 1
            """)
        .bind(edgeId.trim())
        .to("id")
        .fetch()
        .first()
        .map(row -> asAttributes(row.get("props")))
        .orElseGet(Map::of);
  }

  private static Map<String, String> asAttributes(Object raw) {
    if (!(raw instanceof Map<?, ?> map)) {
      return Map.of();
    }
    Map<String, String> out = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      String key = String.valueOf(entry.getKey());
      if (NON_BUSINESS_KEYS.contains(key) || entry.getValue() == null) {
        continue;
      }
      String value = String.valueOf(entry.getValue());
      if (!value.isBlank()) {
        out.put(key, value);
      }
    }
    return Map.copyOf(out);
  }
}
