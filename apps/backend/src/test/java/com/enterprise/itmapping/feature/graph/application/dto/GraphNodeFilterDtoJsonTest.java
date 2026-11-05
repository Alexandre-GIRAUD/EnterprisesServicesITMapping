package com.enterprise.itmapping.feature.graph.application.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class GraphNodeFilterDtoJsonTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void keepsAnEmptyValuesListSoTheFilterMenuCanIterateIt() {
    var freeTextEdgeWithoutFlows =
        new GraphNodeFilterDto("endpoint", "Endpoint", List.of(), false, "EDGE", false, List.of());

    JsonNode json = objectMapper.valueToTree(freeTextEdgeWithoutFlows);

    assertThat(json.has("values")).isTrue();
    assertThat(json.get("values").isArray()).isTrue();
    assertThat(json.get("values")).isEmpty();
  }

  @Test
  void stillLeavesOutEmptyOptionsOutsideTheCatalogue() {
    var nodeField =
        new GraphNodeFilterDto("tier", "Tier", List.of("GOLD"), true, "NODE", false, List.of());

    JsonNode json = objectMapper.valueToTree(nodeField);

    assertThat(json.has("options")).isFalse();
  }
}
