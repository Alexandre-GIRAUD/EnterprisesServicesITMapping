package com.enterprise.itmapping.feature.applications.application;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Reads / writes {@code (:Application)-[:CLASSIFIED_AS {fieldKey}]->(:DataModelRef)} links.
 *
 * <p>Never creates {@code :DataModelRef} nodes — the catalogue is owned by Data Model sync.
 */
@Component
public class ApplicationNodeRefLinkWriter {

  public static final String REL_TYPE = "CLASSIFIED_AS";

  private static final Logger log = LoggerFactory.getLogger(ApplicationNodeRefLinkWriter.class);

  private final Neo4jClient neo4jClient;

  public ApplicationNodeRefLinkWriter(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  /**
   * Replaces all {@code CLASSIFIED_AS} links for the given field keys with the provided ref ids.
   * Empty list for a key clears that key. Keys absent from {@code byFieldKey} are untouched.
   */
  public void replaceLinks(String applicationId, Map<String, List<String>> byFieldKey) {
    if (!StringUtils.hasText(applicationId) || byFieldKey == null || byFieldKey.isEmpty()) {
      return;
    }
    for (Map.Entry<String, List<String>> entry : byFieldKey.entrySet()) {
      String fieldKey = entry.getKey();
      if (!StringUtils.hasText(fieldKey)) {
        continue;
      }
      List<String> refIds =
          entry.getValue() != null
              ? entry.getValue().stream().filter(StringUtils::hasText).distinct().toList()
              : List.of();
      clearField(applicationId, fieldKey);
      for (String refId : refIds) {
        link(applicationId, fieldKey, refId);
      }
      log.debug(
          "CLASSIFIED_AS replaced applicationId={} fieldKey={} refCount={}",
          applicationId,
          fieldKey,
          refIds.size());
    }
  }

  public void clearField(String applicationId, String fieldKey) {
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $appId})-[r:CLASSIFIED_AS {fieldKey: $fieldKey}]->(:DataModelRef)
            DELETE r
            """)
        .bind(applicationId)
        .to("appId")
        .bind(fieldKey)
        .to("fieldKey")
        .run();
  }

  private void link(String applicationId, String fieldKey, String refId) {
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $appId})
            MATCH (ref:DataModelRef {id: $refId})
            WHERE ref.fieldKey = $fieldKey AND coalesce(ref.active, true) = true
            MERGE (a)-[r:CLASSIFIED_AS {fieldKey: $fieldKey}]->(ref)
            """)
        .bind(applicationId)
        .to("appId")
        .bind(refId)
        .to("refId")
        .bind(fieldKey)
        .to("fieldKey")
        .run();
  }

  /** Resolves active catalogue refs by field key + canonical value (case-insensitive). */
  public Map<String, String> resolveActiveRefIdsByValue(String fieldKey, Set<String> canonicalValues) {
    if (!StringUtils.hasText(fieldKey) || canonicalValues == null || canonicalValues.isEmpty()) {
      return Map.of();
    }
    List<String> values = new ArrayList<>(canonicalValues);
    return neo4jClient
        .query(
            """
            MATCH (r:DataModelRef {fieldKey: $fieldKey})
            WHERE coalesce(r.active, true) = true
              AND any(v IN $values WHERE toLower(toString(r.value)) = toLower(v))
            RETURN r.id AS id, r.value AS value
            """)
        .bind(fieldKey)
        .to("fieldKey")
        .bind(values)
        .to("values")
        .fetch()
        .all()
        .stream()
        .collect(
            LinkedHashMap::new,
            (map, row) -> {
              String value = row.get("value") != null ? String.valueOf(row.get("value")) : null;
              String id = row.get("id") != null ? String.valueOf(row.get("id")) : null;
              if (StringUtils.hasText(value) && StringUtils.hasText(id)) {
                map.put(value, id);
              }
            },
            Map::putAll);
  }
}
