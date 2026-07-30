package com.enterprise.itmapping.feature.applications.infrastructure.persistence;

/**
 * Scalar projection for graph visualization — avoids loading {@code Application} entities
 * and hydrating {@code @Relationship} collections (which can fail for Cypher-created edges).
 */
public interface ApplicationGraphNodeProjection {

  String getId();

  String getName();

  String getDescription();
}
