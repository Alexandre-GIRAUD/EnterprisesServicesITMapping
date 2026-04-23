package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Map;
import org.neo4j.driver.Value;

public final class Neo4jValueMapping {

  private Neo4jValueMapping() {}

  @SuppressWarnings("unchecked")
  public static Map<String, Object> asMap(Object row) {
    if (row instanceof Map<?, ?> m) {
      return (Map<String, Object>) m;
    }
    throw new IllegalArgumentException(
        "Expected Map row from Neo4jClient, got: " + (row == null ? "null" : row.getClass().getName()));
  }

  public static String asString(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof String s) {
      return s;
    }
    if (value instanceof Value v) {
      if (v.isNull()) {
        return null;
      }
      return v.asString();
    }
    return value.toString();
  }

  public static Instant asInstant(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof Instant instant) {
      return instant;
    }
    if (value instanceof ZonedDateTime zdt) {
      return zdt.toInstant();
    }
    if (value instanceof OffsetDateTime odt) {
      return odt.toInstant();
    }
    if (value instanceof LocalDateTime ldt) {
      return ldt.atZone(ZoneOffset.UTC).toInstant();
    }
    if (value instanceof java.util.Date date) {
      return date.toInstant();
    }
    if (value instanceof Long epoch) {
      return Instant.ofEpochMilli(epoch);
    }
    if (value instanceof Value v) {
      if (v.isNull()) {
        return null;
      }
      try {
        return v.asZonedDateTime().toInstant();
      } catch (Exception ignored) {
        try {
          return v.asLocalDateTime().atZone(ZoneOffset.UTC).toInstant();
        } catch (Exception ignored2) {
          return null;
        }
      }
    }
    return null;
  }
}
