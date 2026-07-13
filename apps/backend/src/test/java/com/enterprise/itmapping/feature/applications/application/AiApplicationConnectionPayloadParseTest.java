package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload;
import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload.AiConnectionEntry;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class AiApplicationConnectionPayloadParseTest {

  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void parsesOutboundAndInboundConnectionsAndNormalizes() throws Exception {
    String json =
        """
        {
          "assumptions": ["a"],
          "limitations": ["l"],
          "connections": [
            {
              "peer_application_name": "  Service commandes  ",
              "direction": "OutBound",
              "connection_kind": "api",
              "channel": " https://orders.internal/api/v1 ",
              "confidence": "High",
              "business_rationale_one_liner": "Appels REST",
              "evidence_hint": "src/client/OrdersFeignClient.java",
              "edge_attributes": { "product_line": " ALPHA " },
              "unknown_field": "ignored"
            },
            {
              "peer_application_name": "Service facturation",
              "direction": "inbound",
              "connection_kind": "KAFKA",
              "channel": "invoices.generated",
              "confidence": "high"
            }
          ]
        }
        """;

    AiApplicationConnectionPayload payload =
        mapper.readValue(json, AiApplicationConnectionPayload.class);

    assertThat(payload.getAssumptions()).containsExactly("a");
    assertThat(payload.getLimitations()).containsExactly("l");
    assertThat(payload.getConnections()).hasSize(2);

    AiConnectionEntry first = payload.getConnections().get(0);
    assertThat(first.getPeerApplicationName()).isEqualTo("Service commandes");
    assertThat(first.getDirection()).isEqualTo("outbound");
    assertThat(first.getConnectionKind()).isEqualTo("API");
    assertThat(first.getChannel()).isEqualTo("https://orders.internal/api/v1");
    assertThat(first.getConfidence()).isEqualTo("high");
    assertThat(first.getEdgeAttributes()).containsEntry("product_line", "ALPHA");

    AiConnectionEntry second = payload.getConnections().get(1);
    assertThat(second.getDirection()).isEqualTo("inbound");
    assertThat(second.getConnectionKind()).isEqualTo("KAFKA");
  }

  @Test
  void toleratesEmptyConnections() throws Exception {
    AiApplicationConnectionPayload payload =
        mapper.readValue(
            "{\"limitations\":[\"nothing found\"]}", AiApplicationConnectionPayload.class);

    assertThat(payload.getConnections()).isEmpty();
    assertThat(payload.getLimitations()).containsExactly("nothing found");
  }
}
