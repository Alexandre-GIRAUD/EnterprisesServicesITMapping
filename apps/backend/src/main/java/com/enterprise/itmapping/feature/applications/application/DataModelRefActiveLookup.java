package com.enterprise.itmapping.feature.applications.application;

import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Checks that a {@code :DataModelRef} id is active for a given field key. */
@Component
public class DataModelRefActiveLookup {

  private final Neo4jClient neo4jClient;

  public DataModelRefActiveLookup(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public boolean existsActive(String fieldKey, String refId) {
    if (!StringUtils.hasText(fieldKey) || !StringUtils.hasText(refId)) {
      return false;
    }
    return neo4jClient
        .query(
            """
            MATCH (r:DataModelRef {id: $id, fieldKey: $fieldKey})
            WHERE coalesce(r.active, true) = true
            RETURN count(r) AS c
            """)
        .bind(refId)
        .to("id")
        .bind(fieldKey)
        .to("fieldKey")
        .fetch()
        .first()
        .map(row -> ((Number) row.get("c")).longValue() > 0)
        .orElse(false);
  }
}
