package com.enterprise.itmapping.feature.history.infrastructure.persistence;

import com.enterprise.itmapping.feature.history.application.SystemState;
import com.enterprise.itmapping.feature.history.application.SystemState.Relationship;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/** Reads the whole Production graph into a {@link SystemState} and writes one back over it. */
@Component
public class SystemGraphState {

  private static final String APPLICATION = "Application";
  private static final String MODULE = "Module";
  private static final String DATA_MODEL_REF = "DataModelRef";

  private static final List<RelationshipKind> RELATIONSHIP_KINDS =
      List.of(
          new RelationshipKind("DEPENDS_ON", APPLICATION, APPLICATION),
          new RelationshipKind("CONTAINS", APPLICATION, MODULE),
          new RelationshipKind("CONTAINS", MODULE, MODULE),
          new RelationshipKind("CLASSIFIED_AS", APPLICATION, DATA_MODEL_REF));

  private final Neo4jClient neo4jClient;

  public SystemGraphState(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  public SystemState read() {
    List<Relationship> relationships = new ArrayList<>();
    RELATIONSHIP_KINDS.forEach(kind -> relationships.addAll(readRelationships(kind)));
    return new SystemState(readNodes(APPLICATION), readNodes(MODULE), relationships);
  }

  /**
   * Replaces applications, modules and their relationships with {@code state}. Data Model refs stay
   * live, so a classification pointing at a since-deleted ref is dropped. Only call inside a
   * transaction that is rolled back.
   */
  public void overwriteWith(SystemState state) {
    neo4jClient.query("MATCH (n) WHERE n:Application OR n:Module DETACH DELETE n").run();
    createNodes(APPLICATION, state.applications());
    createNodes(MODULE, state.modules());
    RELATIONSHIP_KINDS.forEach(kind -> createRelationships(kind, state.relationships()));
  }

  private List<Map<String, Object>> readNodes(String label) {
    return neo4jClient
        .query("MATCH (n:" + label + ") RETURN properties(n) AS props")
        .fetch()
        .all()
        .stream()
        .map(row -> propertiesOf(row.get("props")))
        .toList();
  }

  private List<Relationship> readRelationships(RelationshipKind kind) {
    return neo4jClient
        .query(
            "MATCH (s:%s)-[r:%s]->(t:%s) RETURN s.id AS sourceId, t.id AS targetId, properties(r) AS props"
                .formatted(kind.sourceLabel(), kind.type(), kind.targetLabel()))
        .fetch()
        .all()
        .stream()
        .map(
            row ->
                new Relationship(
                    kind.type(),
                    kind.sourceLabel(),
                    kind.targetLabel(),
                    String.valueOf(row.get("sourceId")),
                    String.valueOf(row.get("targetId")),
                    propertiesOf(row.get("props"))))
        .toList();
  }

  private void createNodes(String label, List<Map<String, Object>> rows) {
    if (rows.isEmpty()) {
      return;
    }
    neo4jClient
        .query("UNWIND $rows AS props CREATE (n:" + label + ") SET n = props")
        .bind(rows)
        .to("rows")
        .run();
  }

  private void createRelationships(RelationshipKind kind, List<Relationship> relationships) {
    List<Map<String, Object>> rows =
        relationships.stream()
            .filter(kind::matches)
            .map(
                relationship ->
                    Map.<String, Object>of(
                        "sourceId", relationship.sourceId(),
                        "targetId", relationship.targetId(),
                        "props", relationship.properties()))
            .toList();
    if (rows.isEmpty()) {
      return;
    }
    neo4jClient
        .query(
            """
            UNWIND $rows AS rel
            MATCH (s:%s {id: rel.sourceId})
            MATCH (t:%s {id: rel.targetId})
            CREATE (s)-[r:%s]->(t)
            SET r = rel.props
            """
                .formatted(kind.sourceLabel(), kind.targetLabel(), kind.type()))
        .bind(rows)
        .to("rows")
        .run();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> propertiesOf(Object raw) {
    return raw instanceof Map<?, ?> map ? Map.copyOf((Map<String, Object>) map) : Map.of();
  }

  private record RelationshipKind(String type, String sourceLabel, String targetLabel) {

    boolean matches(Relationship relationship) {
      return type.equals(relationship.type())
          && sourceLabel.equals(relationship.sourceLabel())
          && targetLabel.equals(relationship.targetLabel());
    }
  }
}
