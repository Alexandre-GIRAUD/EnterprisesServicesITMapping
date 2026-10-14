package com.enterprise.itmapping.feature.chat.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeRefPatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributePatchService;
import com.enterprise.itmapping.feature.graph.application.GraphNeighborhoodService;
import com.enterprise.itmapping.feature.graph.application.GraphNodeFilterFacetService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto.GraphFilterOptionDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MappingChatCorrectionsTest {

  @Mock ApplicationService applicationService;
  @Mock GraphService graphService;
  @Mock ApplicationNodeAttributePatchService nodeAttributes;
  @Mock ApplicationNodeRefPatchService nodeRefs;
  @Mock GraphEdgeAttributePatchService edgeAttributes;
  @Mock GraphNeighborhoodService neighborhoodService;
  @Mock GraphNodeFilterFacetService filterFacets;
  @Mock ApplicationCatalogQuery catalogQuery;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void createApplicationWritesTheNameAndASecondCallDoesNot() {
    when(applicationService.create(any()))
        .thenReturn(new ApplicationResponse("a1", "Billing", "Pays", false, Map.of()));

    MappingChatCorrections corrections = corrections();
    MappingChatCorrections.CorrectionOutcome created =
        corrections.createApplication("{\"name\":\" Billing \",\"description\":\"Pays\"}");

    assertThat(created.json()).contains("\"accepted\":true");
    assertThat(created.type()).isEqualTo(ChatCitationType.APPLICATION);
    assertThat(created.id()).isEqualTo("a1");
    assertThat(corrections.graphChanged()).isTrue();
    verify(applicationService)
        .create(argThat(request -> "Billing".equals(request.name()) && "Pays".equals(request.description())));

    assertThat(corrections.createApplication("{\"name\":\"CRM\"}").json()).contains("one_correction");
    verify(applicationService, never()).create(argThat(request -> "CRM".equals(request.name())));
  }

  @Test
  void createApplicationRefusesAnEmptyName() {
    MappingChatCorrections.CorrectionOutcome outcome =
        corrections().createApplication("{\"name\":\"  \"}");

    assertThat(outcome.json()).contains("empty_name");
    assertThat(outcome.changed()).isFalse();
    verify(applicationService, never()).create(any());
  }

  @Test
  void createFlowUsesDependsOnAndTheGivenReason() {
    when(catalogQuery.loadAllNamed())
        .thenReturn(List.of(new CatalogRow("a1", "Billing", null), new CatalogRow("a2", "CRM", null)));
    when(graphService.createEdge(any()))
        .thenReturn(new CreateGraphEdgeResponseDto("e1", "a1", "a2", "DEPENDS_ON"));

    MappingChatCorrections.CorrectionOutcome outcome =
        corrections()
            .createFlow("{\"source\":\"Billing\",\"target\":\"CRM\",\"reason\":\"WrongData\"}");

    assertThat(outcome.json()).contains("\"accepted\":true");
    assertThat(outcome.type()).isEqualTo(ChatCitationType.EDGE);
    assertThat(outcome.id()).isEqualTo("e1");
    verify(graphService)
        .createEdge(
            argThat(
                request ->
                    "a1".equals(request.sourceId())
                        && "a2".equals(request.targetId())
                        && "DEPENDS_ON".equals(request.type())
                        && request.changeMeta().reason() == HumanChangeReason.WrongData));
  }

  @Test
  void createFlowRefusesAMissingReasonAndDoesNotWrite() {
    corrections().createFlow("{\"source\":\"Billing\",\"target\":\"CRM\"}");

    verify(graphService, never()).createEdge(any());
  }

  @Test
  void setNodePropertiesStoresCatalogueSpellingAndTheReferenceId() {
    when(catalogQuery.loadAllNamed()).thenReturn(List.of(new CatalogRow("a1", "Billing", null)));
    when(filterFacets.listNodeFilters()).thenReturn(dimensions());

    MappingChatCorrections.CorrectionOutcome outcome =
        corrections()
            .setNodeProperties(
                "{\"application\":\"Billing\",\"reason\":\"WrongSpelling\",\"nodeAttributes\":{\"region\":[\"europe\"]},\"nodeRefs\":{\"Pays\":[\"Europe\"]}}");

    assertThat(outcome.changed()).isTrue();
    verify(nodeAttributes)
        .patchHuman(
            eq("a1"),
            argThat(values -> "Europe".equals(values.get("region"))),
            any(AttributeChangeMetaDto.class));
    verify(nodeRefs).patch(eq("a1"), eq(Map.of("country", List.of("ref-eu"))));
  }

  @Test
  void setNodePropertiesClearsOnlyTheNamedProperty() {
    when(catalogQuery.loadAllNamed()).thenReturn(List.of(new CatalogRow("a1", "Billing", null)));
    when(filterFacets.listNodeFilters()).thenReturn(dimensions());

    corrections()
        .setNodeProperties(
            "{\"application\":\"Billing\",\"reason\":\"OutdatedData\",\"clearNodeAttributes\":[\"region\"]}");

    verify(nodeAttributes)
        .patchHuman(
            eq("a1"),
            argThat(values -> values.containsKey("region") && "".equals(values.get("region"))),
            any(AttributeChangeMetaDto.class));
  }

  @Test
  void setNodePropertiesRefusesAnUnknownKey() {
    when(catalogQuery.loadAllNamed()).thenReturn(List.of(new CatalogRow("a1", "Billing", null)));
    when(filterFacets.listNodeFilters()).thenReturn(dimensions());

    MappingChatCorrections.CorrectionOutcome outcome =
        corrections()
            .setNodeProperties(
                "{\"application\":\"Billing\",\"reason\":\"WrongData\",\"nodeAttributes\":{\"nope\":\"EU\"}}");

    assertThat(outcome.json()).contains("unknown_key");
    verify(nodeAttributes, never()).patchHuman(any(), any(), any());
  }

  @Test
  void setFlowPropertiesRefusesWhenSeveralFlowsExist() {
    when(catalogQuery.loadAllNamed())
        .thenReturn(List.of(new CatalogRow("a1", "Billing", null), new CatalogRow("a2", "CRM", null)));
    when(neighborhoodService.dependsOnIdsBetween("a1", "a2")).thenReturn(List.of("e1", "e2"));

    MappingChatCorrections.CorrectionOutcome outcome =
        corrections()
            .setFlowProperties(
                "{\"source\":\"Billing\",\"target\":\"CRM\",\"reason\":\"WrongData\",\"edgeAttributes\":{\"channel\":\"API\"}}");

    assertThat(outcome.json()).contains("ambiguous_flow");
    verify(edgeAttributes, never()).patchHuman(any(), any(), any());
  }

  @Test
  void setFlowPropertiesWritesTheSingleFlow() {
    when(catalogQuery.loadAllNamed())
        .thenReturn(List.of(new CatalogRow("a1", "Billing", null), new CatalogRow("a2", "CRM", null)));
    when(filterFacets.listNodeFilters()).thenReturn(dimensions());
    when(neighborhoodService.dependsOnIdsBetween("a1", "a2")).thenReturn(List.of("e1"));

    MappingChatCorrections.CorrectionOutcome outcome =
        corrections()
            .setFlowProperties(
                "{\"source\":\"Billing\",\"target\":\"CRM\",\"reason\":\"Others\",\"reasonComment\":\"renamed\",\"edgeAttributes\":{\"channel\":\"api\"}}");

    assertThat(outcome.id()).isEqualTo("e1");
    verify(edgeAttributes)
        .patchHuman(
            eq("e1"),
            argThat(values -> "API".equals(values.get("channel"))),
            argThat(
                meta ->
                    meta.reason() == HumanChangeReason.Others
                        && "renamed".equals(meta.reasonComment())));
  }

  private MappingChatCorrections corrections() {
    return new MappingChatCorrections(
        applicationService,
        graphService,
        nodeAttributes,
        nodeRefs,
        edgeAttributes,
        neighborhoodService,
        filterFacets,
        catalogQuery,
        objectMapper);
  }

  private static List<GraphNodeFilterDto> dimensions() {
    return List.of(
        new GraphNodeFilterDto("region", "Region", List.of("Europe", "US"), true),
        new GraphNodeFilterDto(
            "country",
            "Pays",
            List.of("ref-eu", "ref-us"),
            true,
            "NODE_REF",
            true,
            List.of(
                new GraphFilterOptionDto("ref-eu", "Europe"),
                new GraphFilterOptionDto("ref-us", "United States"))),
        new GraphNodeFilterDto(
            "channel", "Channel", List.of("API", "FILE"), true, "EDGE", false, List.of()));
  }
}
