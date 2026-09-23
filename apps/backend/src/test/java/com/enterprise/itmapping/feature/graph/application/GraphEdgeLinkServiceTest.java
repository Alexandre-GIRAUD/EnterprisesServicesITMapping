package com.enterprise.itmapping.feature.graph.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditActorType;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class GraphEdgeLinkServiceTest {

  @Mock Neo4jClient neo4jClient;
  @Mock AttributeChangeAuditService auditService;

  private GraphEdgeLinkService service;

  @BeforeEach
  void setUp() {
    service = new GraphEdgeLinkService(neo4jClient, auditService, new ObjectMapper());
  }

  @Test
  void deleteHumanRequiresReason() {
    assertThatThrownBy(() -> service.deleteHuman("edge-1", null))
        .isInstanceOf(ResponseStatusException.class);
    verify(auditService, never()).record(any());
  }

  @Test
  void deleteHumanRequiresReasonOnMetaWithoutReason() {
    assertThatThrownBy(
            () -> service.deleteHuman("edge-1", new AttributeChangeMetaDto(null, null)))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void recordCreateAiWritesLinkEvent() {
    service.recordCreateAiFromIds(
        "edge-1",
        "a",
        "b",
        "DEPENDS_ON",
        Map.of("tier", "T1"),
        "API",
        "https://x",
        null,
        "CONNECTION_SUGGESTION");

    ArgumentCaptor<AttributeChangeRequest> captor =
        ArgumentCaptor.forClass(AttributeChangeRequest.class);
    verify(auditService).record(captor.capture());
    AttributeChangeRequest req = captor.getValue();
    assertThat(req.actorType()).isEqualTo(AuditActorType.AI);
    assertThat(req.fieldScope()).isEqualTo(AuditFieldScope.EDGE_LINK);
    assertThat(req.fieldKey()).isEqualTo("__link__");
    assertThat(req.oldValue()).isNull();
    assertThat(req.newValue()).contains("\"sourceId\":\"a\"");
    assertThat(req.newValue()).contains("\"connection_kind\":\"API\"");
    assertThat(req.aiSource()).isEqualTo("CONNECTION_SUGGESTION");
  }

  @Test
  void recordCreateHumanRequiresReason() {
    var snapshot =
        new GraphEdgeLinkService.EdgeLinkSnapshot("a", "b", "DEPENDS_ON", null, null, null, Map.of());
    assertThatThrownBy(() -> service.recordCreateHuman("edge-1", snapshot, null))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void recordCreateHumanWritesReason() {
    var snapshot =
        new GraphEdgeLinkService.EdgeLinkSnapshot("a", "b", "DEPENDS_ON", null, null, null, Map.of());
    service.recordCreateHuman(
        "edge-1", snapshot, new AttributeChangeMetaDto(HumanChangeReason.MissedOnScan, null));

    ArgumentCaptor<AttributeChangeRequest> captor =
        ArgumentCaptor.forClass(AttributeChangeRequest.class);
    verify(auditService).record(captor.capture());
    assertThat(captor.getValue().humanReason()).isEqualTo(HumanChangeReason.MissedOnScan);
    assertThat(captor.getValue().actorType()).isEqualTo(AuditActorType.HUMAN);
  }
}
