package com.enterprise.itmapping.feature.rag.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload;
import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload.Integration;
import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload.NamedDescription;
import com.enterprise.itmapping.feature.integrations.llm.MappingRagProperties;
import com.enterprise.itmapping.feature.rag.domain.DocChunkDraft;
import java.util.List;
import org.junit.jupiter.api.Test;

class FunctionalDocChunkerTest {

  private final MappingRagProperties props =
      new MappingRagProperties(
          true, "text-embedding-3-small", 1536, 8, 0.25, 2000, 80, true, 40, 1200, 200);
  private final FunctionalDocChunker chunker = new FunctionalDocChunker(props);

  @Test
  void chunksSummaryCapabilitiesFlowsConceptsIntegrations() {
    AiFunctionalDocPayload payload = new AiFunctionalDocPayload();
    payload.setTitle("Billing");
    payload.setSummary(
        "Billing handles invoices, payments and refunds for enterprise customers across regions.");
    NamedDescription cap = new NamedDescription();
    cap.setName("Payments");
    cap.setDescription("Collects card and SEPA payments from customers on recurring schedules.");
    payload.setBusinessCapabilities(List.of(cap));
    NamedDescription flow = new NamedDescription();
    flow.setName("Refund flow");
    flow.setDescription("Customer requests refund, finance approves, money is returned.");
    payload.setMainFlows(List.of(flow));
    NamedDescription concept = new NamedDescription();
    concept.setName("Invoice");
    concept.setDescription("Legal billing document issued monthly to B2B accounts.");
    payload.setDataConcepts(List.of(concept));
    Integration integ = new Integration();
    integ.setName("CRM");
    integ.setPurpose("Receives account updates when billing status changes for an account.");
    payload.setIntegrationsFunctional(List.of(integ));

    List<DocChunkDraft> drafts = chunker.chunk(payload, null);

    assertThat(drafts).extracting(DocChunkDraft::sectionKey)
        .containsExactlyInAnyOrder(
            "summary", "capability", "flow", "data_concept", "integration");
    assertThat(drafts).allMatch(d -> d.content().length() >= 40);
    assertThat(drafts).allMatch(d -> d.contentHash() != null && d.contentHash().length() == 64);
  }

  @Test
  void ignoresAssumptionsAndShortNoise() {
    AiFunctionalDocPayload payload = new AiFunctionalDocPayload();
    payload.setSummary("x");
    payload.setAssumptions(List.of("We assume multi-tenant SaaS."));
    payload.setLimitations(List.of("No offline mode."));
    payload.setOutOfScope(List.of("Mobile apps."));

    assertThat(chunker.chunk(payload, null)).isEmpty();
  }

  @Test
  void splitsMarkdownByHeadings() {
    String md =
        """
        ## Overview
        This is a long enough overview section that should become a markdown chunk for RAG indexing purposes.

        ## Payments
        Another long enough section describing how payments are processed end to end for enterprise accounts.
        """;
    List<DocChunkDraft> drafts = chunker.chunk(null, md);
    assertThat(drafts).isNotEmpty();
    assertThat(drafts).allMatch(d -> "markdown".equals(d.sectionKey()));
  }
}
