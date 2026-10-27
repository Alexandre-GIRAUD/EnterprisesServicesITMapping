package com.enterprise.itmapping.feature.changedetection.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.changedetection.application.DetectedChangeDrafts.Draft;
import com.enterprise.itmapping.feature.changedetection.application.DetectedChangeDrafts.ProposedConnection;
import com.enterprise.itmapping.feature.changedetection.application.DetectedChangeDrafts.ProposedModule;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemKind;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DetectedChangeDraftsTest {

  @Test
  void aConnectionDraftNamesThePeerAndTheEdgeValues() {
    Map<String, Object> attributes = new LinkedHashMap<>();
    attributes.put("data", "price");
    attributes.put("frequency", "real-time");

    List<Draft> drafts =
        DetectedChangeDrafts.connections(
            List.of(new ProposedConnection("Trading/Pricing", "outbound", attributes)));

    assertThat(drafts).hasSize(1);
    Draft draft = drafts.get(0);
    assertThat(draft.kind()).isEqualTo(ChangeDetectionItemKind.CONNECTION);
    assertThat(draft.summary())
        .isEqualTo("Outbound connection to Trading/Pricing: data=price, frequency=real-time");
    assertThat(draft.payload())
        .containsEntry("action", "APPLY_CONNECTION")
        .containsEntry("peerApplicationName", "Trading/Pricing")
        .containsEntry("direction", "outbound")
        .containsEntry("edgeAttributes", attributes);
    assertThat(draft.summary()).doesNotContain("re-run");
  }

  @Test
  void oneConnectionKeepsEdgeValuesReadFromTheDiff() {
    List<ProposedConnection> proposed =
        DetectedChangeDrafts.attachSingleEdgeHits(
            List.of(new ProposedConnection("Trading/Pricing", "outbound", Map.of())),
            Map.of("frequency", "real-time", "data", "price"));

    List<Draft> drafts = DetectedChangeDrafts.connections(proposed);

    assertThat(drafts.get(0).summary())
        .isEqualTo("Outbound connection to Trading/Pricing: data=price, frequency=real-time");
  }

  @Test
  void severalConnectionsDoNotReceiveGuessedEdgeValues() {
    List<ProposedConnection> proposed =
        DetectedChangeDrafts.attachSingleEdgeHits(
            List.of(
                new ProposedConnection("Trading/Pricing", "outbound", Map.of()),
                new ProposedConnection("Risk", "inbound", Map.of())),
            Map.of("data", "price"));

    assertThat(DetectedChangeDrafts.connections(proposed))
        .extracting(Draft::summary)
        .containsExactly(
            "Outbound connection to Trading/Pricing", "Inbound connection to Risk");
  }

  @Test
  void aModuleDraftNamesTheModule() {
    List<Draft> drafts =
        DetectedChangeDrafts.modules(List.of(new ProposedModule("billing-api", "Billing API")));

    assertThat(drafts).hasSize(1);
    assertThat(drafts.get(0).kind()).isEqualTo(ChangeDetectionItemKind.MODULE);
    assertThat(drafts.get(0).summary()).isEqualTo("New module Billing API");
    assertThat(drafts.get(0).payload())
        .containsEntry("action", "APPLY_MODULE")
        .containsEntry("slug", "billing-api")
        .containsEntry("businessName", "Billing API");
  }

  @Test
  void anExistingModuleNameIsNotProposedAgain() {
    List<ProposedModule> proposed =
        List.of(
            new ProposedModule("booking", "booking"),
            new ProposedModule("booking-api", " Booking "),
            new ProposedModule("settlement", "Settlement"));

    List<Draft> drafts =
        DetectedChangeDrafts.modules(
            DetectedChangeDrafts.withoutExistingModules(proposed, List.of("Booking")));

    assertThat(drafts).extracting(Draft::summary).containsExactly("New module Settlement");
  }

  @Test
  void nothingIsDraftedWhenTheDiffNamesNothing() {
    assertThat(DetectedChangeDrafts.connections(List.of())).isEmpty();
    assertThat(DetectedChangeDrafts.modules(List.of())).isEmpty();
  }
}
