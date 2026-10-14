package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.datamodel.application.AttributeValues;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Persists Data Model {@code NODE} attributes on the analyzed {@code :Application} node.
 *
 * <p>Uses {@code SET a += $dynamicProps} with a whitelist of keys from the active Data Model.
 * Values overwrite previous ones (AI refresh). Does not touch identity fields ({@code id},
 * {@code name}, {@code description}).
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
      Map<String, ?> dataModelAttributes,
      Set<String> allowedDataModelKeys) {
    Map<String, Object> dynamicProps =
        AttributeValues.whitelisted(dataModelAttributes, allowedDataModelKeys);
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

  /**
   * Clears dynamic properties on the Application node.
   *
   * @param validatedKeys keys already validated against the Data Model (they become Cypher
   *     identifiers)
   * @return number of properties removed (0 if nothing to do)
   */
  public int remove(String applicationId, Set<String> validatedKeys) {
    if (!StringUtils.hasText(applicationId) || validatedKeys == null || validatedKeys.isEmpty()) {
      return 0;
    }
    String removals =
        validatedKeys.stream().map(key -> "a.`" + key + "`").collect(Collectors.joining(", "));
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $id})
            REMOVE %s
            """
                .formatted(removals))
        .bind(applicationId)
        .to("id")
        .run();

    log.debug("Application node Data Model props removed id={} keys={}", applicationId, validatedKeys);
    return validatedKeys.size();
  }
}
