package com.enterprise.itmapping.config;

import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * One-shot cleanup of the relational entities replaced by Data Model {@code target=NODE} attributes.
 *
 * <p>{@code :BusinessUnit} and {@code :Region} used to group applications through
 * {@code HAS_APPLICATION} / {@code IS_USED_IN}; those dimensions are now flat properties on
 * {@code :Application} declared in the Data Model. {@code :Contributor} was removed by the same
 * change.
 *
 * <p>Soft-flatten: when the admin has declared a Data Model NODE field named {@code business_unit} or
 * {@code region}, the legacy name/code is copied onto the application before its node is deleted;
 * otherwise the data is dropped (documented breaking change). Disable with
 * {@code app.legacy-graph-cleanup.enabled=false}.
 */
@Component
@Order(90)
public class LegacyGraphNodeCleanup implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(LegacyGraphNodeCleanup.class);

  private final Neo4jClient neo4jClient;
  private final DataModelService dataModelService;

  @Value("${app.legacy-graph-cleanup.enabled:true}")
  private boolean enabled;

  public LegacyGraphNodeCleanup(Neo4jClient neo4jClient, DataModelService dataModelService) {
    this.neo4jClient = neo4jClient;
    this.dataModelService = dataModelService;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (!enabled) {
      return;
    }
    try {
      Set<String> nodeKeys =
          dataModelService.loadConfig().nodeFields().stream()
              .map(DataModelField::key)
              .collect(Collectors.toSet());

      if (nodeKeys.contains("business_unit")) {
        flatten(
            "business_unit",
            """
            MATCH (bu:BusinessUnit)-[:HAS_APPLICATION]->(a:Application)
            WHERE bu.name IS NOT NULL
            SET a.business_unit = coalesce(a.business_unit, bu.name)
            """);
      }
      if (nodeKeys.contains("region")) {
        flatten(
            "region",
            """
            MATCH (a:Application)-[:IS_USED_IN]->(reg:Region)
            WHERE reg.code IS NOT NULL
            SET a.region = coalesce(a.region, reg.code)
            """);
      }

      long removed =
          detachDelete("BusinessUnit") + detachDelete("Region") + detachDelete("Contributor");
      if (removed > 0) {
        log.info(
            "Legacy graph cleanup: removed {} :BusinessUnit/:Region/:Contributor node(s)", removed);
      }
    } catch (Exception e) {
      log.warn("Legacy graph cleanup skipped ({})", e.getMessage());
      log.debug("Legacy graph cleanup failure details", e);
    }
  }

  private void flatten(String dataModelKey, String flattenCypher) {
    neo4jClient.query(flattenCypher).run();
    log.info("Legacy graph cleanup: flattened legacy values into a.{}", dataModelKey);
  }

  private long detachDelete(String label) {
    String cypher =
        """
        MATCH (n:%s)
        DETACH DELETE n
        RETURN count(*) AS removed
        """
            .formatted(label);
    return neo4jClient.query(cypher).fetch().first().map(LegacyGraphNodeCleanup::asLong).orElse(0L);
  }

  private static long asLong(Map<String, Object> row) {
    Object value = row.get("removed");
    return value instanceof Number number ? number.longValue() : 0L;
  }
}
