package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.datamodel.application.AttributeValues;
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

  public Map<String, Object> read(String applicationId) {
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
        .map(row -> AttributeValues.readProperties(row.get("props"), NON_BUSINESS_KEYS))
        .orElseGet(Map::of);
  }
}
