package com.enterprise.itmapping.feature.graph.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class AttributeMatchTest {

  @Test
  void blankOnlyMatchesMissingValues() {
    AttributeMatch.Split split = AttributeMatch.split(List.of(AttributeMatch.EMPTY));

    assertThat(split.includeEmpty()).isTrue();
    assertThat(split.values()).isEmpty();
    assertThat(AttributeMatch.cypher(new AttributeMatch.Clause("a", "description", "nodeAttr_description", split)))
        .contains("a.`description` IS NULL")
        .doesNotContain(" IN $");
  }

  @Test
  void valueOrBlankMatchesEither() {
    AttributeMatch.Split split = AttributeMatch.split(List.of("Billing", AttributeMatch.EMPTY));

    assertThat(AttributeMatch.cypher(new AttributeMatch.Clause("r", "frequency", "edgeAttr_frequency", split)))
        .contains("toString(r.`frequency`) IN $edgeAttr_frequency")
        .contains("r.`frequency` IS NULL");
  }
}
