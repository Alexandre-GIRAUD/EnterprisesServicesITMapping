package com.enterprise.itmapping.feature.applications.application;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Repository;

/** Reads and writes the editable details stored as properties on a {@code :Module} node. */
@Repository
public class ModuleDetailsStore {

  public record ModuleDetails(
      String description,
      String owner,
      List<String> actors,
      String trigger,
      List<String> dataIn,
      List<String> dataOut) {}

  private final Neo4jClient neo4jClient;

  public ModuleDetailsStore(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  /** Empty when the module does not sit under the application. */
  public Optional<ModuleDetails> read(String applicationId, String moduleId) {
    return neo4jClient
        .query(
            """
            MATCH (:Application {id: $appId})-[:CONTAINS*1..50]->(m:Module {id: $moduleId})
            RETURN m.description AS description, m.owner AS owner, m.actors AS actors,
                   m.trigger AS trigger, m.dataIn AS dataIn, m.dataOut AS dataOut
            LIMIT 1
            """)
        .bind(applicationId)
        .to("appId")
        .bind(moduleId)
        .to("moduleId")
        .fetch()
        .first()
        .map(
            row ->
                new ModuleDetails(
                    asText(row.get("description")),
                    asText(row.get("owner")),
                    asList(row.get("actors")),
                    asText(row.get("trigger")),
                    asList(row.get("dataIn")),
                    asList(row.get("dataOut"))));
  }

  /** Empty values remove the property. */
  public void write(String moduleId, ModuleDetails details) {
    neo4jClient
        .query(
            """
            MATCH (m:Module {id: $moduleId})
            SET m.description = $description, m.owner = $owner, m.actors = $actors,
                m.trigger = $trigger, m.dataIn = $dataIn, m.dataOut = $dataOut
            """)
        .bind(moduleId)
        .to("moduleId")
        .bind(details.description())
        .to("description")
        .bind(details.owner())
        .to("owner")
        .bind(emptyToNull(details.actors()))
        .to("actors")
        .bind(details.trigger())
        .to("trigger")
        .bind(emptyToNull(details.dataIn()))
        .to("dataIn")
        .bind(emptyToNull(details.dataOut()))
        .to("dataOut")
        .run();
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
