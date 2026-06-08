package com.enterprise.itmapping.domain;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.support.UUIDStringGenerator;

/**
 * Person contributing to applications. Graph links ({@code WORK_IN}, {@code WORK_ON},
 * {@code REPORTS_TO}) are maintained via Cypher in {@link
 * com.enterprise.itmapping.feature.contributors.application.ContributorLinkService} — not mapped
 * as SDN relationships on this entity.
 *
 * <p><strong>Manager (v1)</strong>: optional {@code (:Contributor)-[:REPORTS_TO]->(:Contributor)} —
 * not using free-text manager fields.
 *
 * <p><strong>{@code WORK_ON}</strong>: simple relationship in v1.
 */
@Node("Contributor")
public class Contributor {

  @Id @GeneratedValue(UUIDStringGenerator.class)
  private String id;

  private String firstName;
  private String lastName;
  private String team;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getFirstName() {
    return firstName;
  }

  public void setFirstName(String firstName) {
    this.firstName = firstName;
  }

  public String getLastName() {
    return lastName;
  }

  public void setLastName(String lastName) {
    this.lastName = lastName;
  }

  public String getTeam() {
    return team;
  }

  public void setTeam(String team) {
    this.team = team;
  }
}
