package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Materializes Data Model {@code NODE_REF} allowed values as {@code :DataModelRef} catalogue nodes.
 *
 * <p>Values present in the config are upserted with {@code active=true}. Values previously synced
 * for a field key but absent from the new config are soft-retired ({@code active=false}) — existing
 * {@code CLASSIFIED_AS} links are kept.
 */
@Service
public class DataModelRefSyncService {

  private static final Logger log = LoggerFactory.getLogger(DataModelRefSyncService.class);

  private final Neo4jClient neo4jClient;

  public DataModelRefSyncService(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public void sync(DataModelConfig config) {
    List<DataModelField> nodeRefFields =
        config != null ? config.nodeRefFields() : List.of();
    Set<String> activeFieldKeys = new HashSet<>();

    for (DataModelField field : nodeRefFields) {
      activeFieldKeys.add(field.key());
      Set<String> activeIds = new HashSet<>();
      for (String rawValue : field.allowedValues()) {
        String value = DataModelRefIds.canonicalValue(rawValue);
        if (!StringUtils.hasText(value)) {
          continue;
        }
        String id = DataModelRefIds.stableId(field.key(), value);
        activeIds.add(id);
        upsert(id, field.key(), value, DataModelRefIds.displayName(field, value));
      }
      softRetireMissing(field.key(), activeIds);
      log.info(
          "DataModelRef sync fieldKey={} activeValues={}", field.key(), field.allowedValues().size());
    }

    softRetireRemovedFields(activeFieldKeys);
  }

  private void upsert(String id, String fieldKey, String value, String name) {
    Map<String, Object> params = new HashMap<>();
    params.put("id", id);
    params.put("fieldKey", fieldKey);
    params.put("value", value);
    params.put("name", name);
    neo4jClient
        .query(
            """
            MERGE (r:DataModelRef {id: $id})
            SET r.fieldKey = $fieldKey,
                r.value = $value,
                r.name = $name,
                r.active = true
            """)
        .bindAll(params)
        .run();
  }

  private void softRetireMissing(String fieldKey, Set<String> activeIds) {
    List<String> keep = new ArrayList<>(activeIds);
    neo4jClient
        .query(
            """
            MATCH (r:DataModelRef {fieldKey: $fieldKey})
            WHERE NOT r.id IN $keepIds
            SET r.active = false
            """)
        .bind(fieldKey)
        .to("fieldKey")
        .bind(keep.isEmpty() ? List.of("__none__") : keep)
        .to("keepIds")
        .run();
  }

  private void softRetireRemovedFields(Set<String> activeFieldKeys) {
    neo4jClient
        .query(
            """
            MATCH (r:DataModelRef)
            WHERE size($activeFieldKeys) = 0 OR NOT r.fieldKey IN $activeFieldKeys
            SET r.active = false
            """)
        .bind(new ArrayList<>(activeFieldKeys))
        .to("activeFieldKeys")
        .run();
  }
}
