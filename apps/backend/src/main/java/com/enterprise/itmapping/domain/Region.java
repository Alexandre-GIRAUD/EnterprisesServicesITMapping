package com.enterprise.itmapping.domain;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.support.UUIDStringGenerator;

/**
 * Geographic / organizational region. Applications link via {@code IS_USED_IN}
 * ({@code (Application)-[:IS_USED_IN]->(Region)}). Not part of the Cytoscape dependency payload.
 */
@Node("Region")
public class Region {

  @Id @GeneratedValue(UUIDStringGenerator.class)
  private String id;

  /** Stable business code, e.g. {@code EMEA}, {@code APAC}, {@code AMERICAS}. */
  private String code;

  private String name;
  private String description;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getCode() {
    return code;
  }

  public void setCode(String code) {
    this.code = code;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }
}
