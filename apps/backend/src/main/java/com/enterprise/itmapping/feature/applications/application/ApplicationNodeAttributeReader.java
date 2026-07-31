package com.enterprise.itmapping.feature.applications.application;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Reads the dynamic business properties stored on an {@code :Application} node. */
@Component
public class ApplicationNodeAttributeReader {

  /** Identity / system properties never exposed as business attributes. */
  private static final Set<String> NON_BUSINESS_KEYS =
      Set.of("id", "name", "description", "year", "validFrom", "validTo");

  private final Neo4jClient neo4jClient;

  public ApplicationNodeAttributeReader(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public Map<String, String> read(String applicationId) {
    if (!StringUtils.hasText(applicationId)) {
      return Map.of();
    }
    return neo4jClient
        .query(
            """
            MATCH (a:Application {id: $id})
            RETURN properties(a) AS props
            """)
        .bind(applicationId)
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
