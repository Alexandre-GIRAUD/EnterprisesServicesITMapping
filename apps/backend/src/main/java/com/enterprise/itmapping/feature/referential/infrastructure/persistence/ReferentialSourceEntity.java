package com.enterprise.itmapping.feature.referential.infrastructure.persistence;

import com.enterprise.itmapping.feature.referential.domain.ReferentialIdentity;
import com.enterprise.itmapping.feature.referential.domain.ReferentialMapping;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Workspace referential: endpoint, write-only secret, identity rows, and field mappings. */
@Entity
@Table(name = "referential_source")
public class ReferentialSourceEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Column(nullable = false, length = 120)
  private String name;

  @Column(name = "url_template", nullable = false, length = 2000)
  private String urlTemplate;

  @Column(name = "header_name", length = 120)
  private String headerName;

  @Column(name = "secret")
  private String secret;

  @Column(name = "sample_body")
  private String sampleBody;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<ReferentialIdentity> identities = new ArrayList<>();

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<ReferentialMapping> mappings = new ArrayList<>();

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getUrlTemplate() {
    return urlTemplate;
  }

  public void setUrlTemplate(String urlTemplate) {
    this.urlTemplate = urlTemplate;
  }

  public String getHeaderName() {
    return headerName;
  }

  public void setHeaderName(String headerName) {
    this.headerName = headerName;
  }

  public String getSecret() {
    return secret;
  }

  public void setSecret(String secret) {
    this.secret = secret;
  }

  public String getSampleBody() {
    return sampleBody;
  }

  public void setSampleBody(String sampleBody) {
    this.sampleBody = sampleBody;
  }

  public List<ReferentialIdentity> getIdentities() {
    return identities != null ? identities : List.of();
  }

  public void setIdentities(List<ReferentialIdentity> identities) {
    this.identities = identities != null ? new ArrayList<>(identities) : new ArrayList<>();
  }

  public List<ReferentialMapping> getMappings() {
    return mappings != null ? mappings : List.of();
  }

  public void setMappings(List<ReferentialMapping> mappings) {
    this.mappings = mappings != null ? new ArrayList<>(mappings) : new ArrayList<>();
  }
}
