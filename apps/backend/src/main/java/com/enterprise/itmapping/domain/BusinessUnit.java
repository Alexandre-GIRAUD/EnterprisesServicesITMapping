package com.enterprise.itmapping.domain;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.support.UUIDStringGenerator;

/**
 * Organizational grouping above {@link Application}. Linked via {@code HAS_APPLICATION}
 * (see seed and Cypher); not part of the Cytoscape application-dependency payload.
 *
 * <p>At most one {@code HAS_APPLICATION} from a BU to a given application version is expected
 * (enforced by operations / seed, not by a Neo4j constraint in v1).
 */
@Node("BusinessUnit")
public class BusinessUnit {

  @Id @GeneratedValue(UUIDStringGenerator.class)
  private String id;

  private String name;
  private String code;
  private String description;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getCode() {
    return code;
  }

  public void setCode(String code) {
    this.code = code;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }
}
