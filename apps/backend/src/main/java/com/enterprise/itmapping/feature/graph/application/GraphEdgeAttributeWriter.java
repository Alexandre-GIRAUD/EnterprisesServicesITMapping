package com.enterprise.itmapping.feature.graph.application;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Persists Data Model {@code EDGE} attributes on a {@code DEPENDS_ON} relationship. */
@Component
public class GraphEdgeAttributeWriter {

  private static final Logger log = LoggerFactory.getLogger(GraphEdgeAttributeWriter.class);

  private final Neo4jClient neo4jClient;

  public GraphEdgeAttributeWriter(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public int write(String edgeId, Map<String, String> dataModelAttributes, Set<String> allowedKeys) {
    Map<String, String> dynamicProps = filterDynamicProps(dataModelAttributes, allowedKeys);
    if (!StringUtils.hasText(edgeId) || dynamicProps.isEmpty()) {
      return 0;
    }
    neo4jClient
        .query(
            """
            MATCH ()-[r:DEPENDS_ON {id: $id}]->()
            SET r += $dynamicProps
            """)
        .bind(edgeId.trim())
        .to("id")
        .bind(dynamicProps)
        .to("dynamicProps")
        .run();
    log.debug("Edge Data Model props updated id={} keys={}", edgeId, dynamicProps.keySet());
    return dynamicProps.size();
  }

  public int remove(String edgeId, Set<String> validatedKeys) {
    if (!StringUtils.hasText(edgeId) || validatedKeys == null || validatedKeys.isEmpty()) {
      return 0;
    }
    String removals =
        validatedKeys.stream().map(key -> "r.`" + key + "`").collect(Collectors.joining(", "));
    neo4jClient
        .query(
            """
            MATCH ()-[r:DEPENDS_ON {id: $id}]->()
            REMOVE %s
            """
                .formatted(removals))
        .bind(edgeId.trim())
        .to("id")
        .run();
    log.debug("Edge Data Model props removed id={} keys={}", edgeId, validatedKeys);
    return validatedKeys.size();
  }

  private static Map<String, String> filterDynamicProps(
      Map<String, String> dataModelAttributes, Set<String> allowedDataModelKeys) {
    if (dataModelAttributes == null
        || dataModelAttributes.isEmpty()
        || allowedDataModelKeys == null
        || allowedDataModelKeys.isEmpty()) {
      return Map.of();
    }
    Map<String, String> out = new LinkedHashMap<>();
    for (Map.Entry<String, String> entry : dataModelAttributes.entrySet()) {
      String key = entry.getKey();
      String value = entry.getValue();
      if (!StringUtils.hasText(key) || !StringUtils.hasText(value)) {
        continue;
      }
      if (allowedDataModelKeys.contains(key)) {
        out.put(key, value.trim());
      }
    }
    return out;
  }
}
