package com.enterprise.itmapping.feature.applications.application;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Repository;

/**
 * Reads and writes the business model of an application: its lexicon of business objects, its
 * main journey and scope (properties of the {@code :Application} node), and the explicit links
 * between its modules ({@code (:Module)-[:FEEDS {object}]->(:Module)}).
 */
@Repository
public class BusinessModelStore {

  /** One module feeds another through a business object; the object may be empty. */
  public record ModuleLink(String sourceId, String targetId, String object) {}

  public record BusinessModel(
      List<String> businessObjects, String mainJourney, String scope, List<ModuleLink> links) {}

  private final Neo4jClient neo4jClient;

  public BusinessModelStore(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  /** Empty when the application does not exist. */
  public Optional<BusinessModel> read(String applicationId) {
    return neo4jClient
        .query(
            """
            MATCH (a:Application {id: $appId})
            RETURN a.businessObjects AS businessObjects, a.mainJourney AS mainJourney, a.scope AS scope
            """)
        .bind(applicationId)
        .to("appId")
        .fetch()
        .first()
        .map(
            row ->
                new BusinessModel(
                    asList(row.get("businessObjects")),
                    asText(row.get("mainJourney")),
                    asText(row.get("scope")),
                    readLinks(applicationId)));
  }

  /** Module id to name for every module under the application. */
  public Map<String, String> moduleNames(String applicationId) {
    Map<String, String> names = new LinkedHashMap<>();
    neo4jClient
        .query(
            """
            MATCH (:Application {id: $appId})-[:CONTAINS*1..50]->(m:Module)
            RETURN DISTINCT m.id AS id, m.name AS name
            """)
        .bind(applicationId)
        .to("appId")
        .fetch()
        .all()
        .forEach(row -> names.put(String.valueOf(row.get("id")), String.valueOf(row.get("name"))));
    return names;
  }

  /** Replaces the lexicon, journey, scope and every FEEDS link between the application modules. */
  public void write(String applicationId, BusinessModel model) {
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $appId})
            SET a.businessObjects = $businessObjects, a.mainJourney = $mainJourney, a.scope = $scope
            """)
        .bind(applicationId)
        .to("appId")
        .bind(emptyToNull(model.businessObjects()))
        .to("businessObjects")
        .bind(model.mainJourney())
        .to("mainJourney")
        .bind(model.scope())
        .to("scope")
        .run();
    neo4jClient
        .query(
            """
            MATCH (:Application {id: $appId})-[:CONTAINS*1..50]->(:Module)-[f:FEEDS]->(:Module)
            DELETE f
            """)
        .bind(applicationId)
        .to("appId")
        .run();
    for (ModuleLink link : model.links()) {
      writeLink(applicationId, link);
    }
  }

  private void writeLink(String applicationId, ModuleLink link) {
    neo4jClient
        .query(
            """
            MATCH (a:Application {id: $appId})
            MATCH (a)-[:CONTAINS*1..50]->(s:Module {id: $sourceId})
            MATCH (a)-[:CONTAINS*1..50]->(t:Module {id: $targetId})
            MERGE (s)-[:FEEDS {object: $object}]->(t)
            """)
        .bind(applicationId)
        .to("appId")
        .bind(link.sourceId())
        .to("sourceId")
        .bind(link.targetId())
        .to("targetId")
        .bind(link.object() == null ? "" : link.object())
        .to("object")
        .run();
  }

  private List<ModuleLink> readLinks(String applicationId) {
    return neo4jClient
        .query(
            """
            MATCH (:Application {id: $appId})-[:CONTAINS*1..50]->(s:Module)-[f:FEEDS]->(t:Module)
            RETURN DISTINCT s.id AS sourceId, t.id AS targetId, f.object AS object
            """)
        .bind(applicationId)
        .to("appId")
        .fetch()
        .all()
        .stream()
        .map(
            row ->
                new ModuleLink(
                    String.valueOf(row.get("sourceId")),
                    String.valueOf(row.get("targetId")),
                    asText(row.get("object"))))
        .toList();
  }

  private static List<String> emptyToNull(List<String> values) {
    return values == null || values.isEmpty() ? null : values;
  }

  private static String asText(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private static List<String> asList(Object value) {
    if (value instanceof Collection<?> items) {
      return items.stream().map(String::valueOf).toList();
    }
    return value == null ? List.of() : List.of(String.valueOf(value));
  }
}
