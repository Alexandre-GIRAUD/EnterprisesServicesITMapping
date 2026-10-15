package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.graph.application.AttributeMatch;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GraphLoaderNodeRefFilterTest {

  @Test
  void blankNodeRefMatchesApplicationsWithNoClassification() {
    String cypher = GraphLoader.buildNodeCypher(null, Map.of("tier", List.of(AttributeMatch.EMPTY)));

    assertThat(cypher).contains("NOT EXISTS");
    assertThat(cypher).contains("CLASSIFIED_AS");
    assertThat(cypher).doesNotContain("ref.id IN");
  }

  @Test
  void blankOrListedNodeRefMatchesEither() {
    String cypher =
        GraphLoader.buildNodeCypher(null, Map.of("tier", List.of(AttributeMatch.EMPTY, "id-gold")));

    assertThat(cypher).contains("NOT EXISTS");
    assertThat(cypher).contains("ref.id IN $nodeRefIds_0");
  }
}
