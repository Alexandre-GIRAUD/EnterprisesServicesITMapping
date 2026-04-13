package com.enterprise.itmapping.feature.applications.infrastructure.persistence;

import java.time.Instant;

/**
 * Scalar projection for graph visualization — avoids loading {@code Application} entities
 * and hydrating {@code @Relationship} collections (which can fail for Cypher-created edges).
 */
public interface ApplicationGraphNodeProjection {

  String getId();

  String getName();

  String getDescription();

  Instant getValidFrom();

  Instant getValidTo();
}
