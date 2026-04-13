package com.enterprise.itmapping.common;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

/**
 * Neo4j Java driver's {@code Values.value()} does not accept {@link Instant} as a Cypher parameter.
 * Bind {@link ZonedDateTime} (UTC) instead.
 */
public final class Neo4jTemporalParameters {

  private Neo4jTemporalParameters() {}

  public static ZonedDateTime toNeo4j(Instant instant) {
    return instant == null ? null : instant.atZone(ZoneOffset.UTC);
  }
}
