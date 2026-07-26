package com.enterprise.itmapping.feature.applications.application;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Persists Data Model {@code NODE} attributes on the analyzed {@code :Application} node.
 *
 * <p>Uses {@code SET a += $dynamicProps} with a whitelist of keys from the active Data Model.
 * Values overwrite previous ones (AI refresh). Does not touch SDN entity fields ({@code name},
 * {@code description}, {@code year}, {@code id}).
 */
@Component
public class ApplicationNodeAttributeWriter {

  private static final Logger log = LoggerFactory.getLogger(ApplicationNodeAttributeWriter.class);

  private final Neo4jClient neo4jClient;

  public ApplicationNodeAttributeWriter(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  /**
   * Writes validated dynamic properties onto the Application node.
   *
   * @return number of properties written (0 if nothing to do)
   */
  public int write(
      String applicationId,
      Map<String, String> dataModelAttributes,
      Set<String> allowedDataModelKeys) {
    Map<String, String> dynamicProps =
        filterDynamicProps(dataModelAttributes, allowedDataModelKeys);
    if (!StringUtils.hasText(applicationId) || dynamicProps.isEmpty()) {
      return 0;
    }

    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $id})
            SET a += $dynamicProps
            """)
        .bind(applicationId)
        .to("id")
        .bind(dynamicProps)
        .to("dynamicProps")
        .run();

    log.debug(
        "Application node Data Model props updated id={} keys={}",
        applicationId,
        dynamicProps.keySet());
    return dynamicProps.size();
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
