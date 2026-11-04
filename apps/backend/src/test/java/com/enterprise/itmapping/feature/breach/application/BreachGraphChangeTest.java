package com.enterprise.itmapping.feature.breach.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemKind;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class BreachGraphChangeTest {

  private static final GraphResponseDto GRAPH =
      new GraphResponseDto(
          List.of(
              new GraphNodeDto("app", "Billing", "Application", null, Map.of("cost", "10k")),
              new GraphNodeDto("crm", "CRM", "Application", null, Map.of())),
          List.of());

  @Test
  void anAttributeChangeSetsThePropertyOnTheRunApplication() {
    GraphResponseDto changed =
        BreachGraphChange.apply(
            GRAPH, "app", ChangeDetectionItemKind.NODE_ATTRIBUTE, Map.of("key", "cost", "value", "150k"));

    assertThat(changed.nodes().get(0).properties()).containsEntry("cost", "150k");
    assertThat(GRAPH.nodes().get(0).properties()).containsEntry("cost", "10k");
  }

  @Test
  void anOutboundConnectionAddsAFlowToThePeerFoundByName() {
    GraphResponseDto changed =
        BreachGraphChange.apply(
            GRAPH,
            "app",
            ChangeDetectionItemKind.CONNECTION,
            Map.of(
                "peerApplicationName", "crm",
                "direction", "outbound",
                "edgeAttributes", Map.of("protocol", "FTP")));

    assertThat(changed.edges()).hasSize(1);
    GraphEdgeDto flow = changed.edges().get(0);
    assertThat(flow.id()).isEqualTo(BreachGraphChange.PROPOSED_FLOW_ID);
    assertThat(flow.sourceId()).isEqualTo("app");
    assertThat(flow.targetId()).isEqualTo("crm");
    assertThat(flow.properties()).containsEntry("protocol", "FTP");
  }

  @Test
  void anInboundConnectionToAnUnknownPeerAddsAnAttributelessApplication() {
    GraphResponseDto changed =
        BreachGraphChange.apply(
            GRAPH,
            "app",
            ChangeDetectionItemKind.CONNECTION,
            Map.of("peerApplicationName", "Ledger", "direction", "inbound"));

    assertThat(changed.nodes()).hasSize(3);
    GraphNodeDto peer = changed.nodes().get(2);
    assertThat(peer.label()).isEqualTo("Ledger");
    assertThat(peer.properties()).isEmpty();
    assertThat(changed.edges().get(0).sourceId()).isEqualTo(peer.id());
    assertThat(changed.edges().get(0).targetId()).isEqualTo("app");
  }

  @Test
  void aModuleChangeLeavesTheGraphAsItIs() {
    assertThat(BreachGraphChange.apply(GRAPH, "app", ChangeDetectionItemKind.MODULE, Map.of()))
        .isEqualTo(GRAPH);
  }
}
