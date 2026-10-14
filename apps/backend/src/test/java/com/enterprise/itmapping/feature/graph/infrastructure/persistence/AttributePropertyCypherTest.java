package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AttributePropertyCypherTest {

  @Test
  void matchTreatsAStringAndAListAsTheSameFilter() {
    String cypher = AttributePropertyCypher.matchesAny("a", "zone", "nodeAttr_zone");

    assertThat(cypher).contains("a.`zone` IS :: LIST<ANY>");
    assertThat(cypher).contains("toString(v) IN $nodeAttr_zone");
  }

  @Test
  void distinctValuesUnwindEachListElement() {
    String cypher =
        AttributePropertyCypher.distinctValues("MATCH (a:Application)", "a", "zone");

    assertThat(cypher).contains("UNWIND CASE WHEN a.`zone` IS :: LIST<ANY>");
    assertThat(cypher).contains("RETURN value ORDER BY value");
  }
}
