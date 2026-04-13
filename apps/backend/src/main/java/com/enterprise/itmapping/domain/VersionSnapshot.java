package com.enterprise.itmapping.domain;

import java.time.Instant;
import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.support.UUIDStringGenerator;

@Node("VersionSnapshot")
public class VersionSnapshot {

  @Id
  @GeneratedValue(UUIDStringGenerator.class)
  private String id;

  private String versionTag;
  private String description;
  private Instant validFrom;
  private Instant validTo;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getVersionTag() {
    return versionTag;
  }

  public void setVersionTag(String versionTag) {
    this.versionTag = versionTag;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public Instant getValidFrom() {
    return validFrom;
  }

  public void setValidFrom(Instant validFrom) {
    this.validFrom = validFrom;
  }

  public Instant getValidTo() {
    return validTo;
  }

  public void setValidTo(Instant validTo) {
    this.validTo = validTo;
  }
}
