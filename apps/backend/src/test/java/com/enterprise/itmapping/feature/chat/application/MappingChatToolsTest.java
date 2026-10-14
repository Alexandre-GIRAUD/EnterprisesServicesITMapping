package com.enterprise.itmapping.feature.chat.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeRefPatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskRequest;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatMapFilters;
import com.enterprise.itmapping.feature.functionaldoc.application.FunctionalDocumentationService;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributePatchService;
import com.enterprise.itmapping.feature.graph.application.GraphNeighborhoodService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.GraphNodeFilterFacetService;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto.NeighborhoodApplicationDto;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto.NeighborhoodEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto.GraphFilterOptionDto;
import com.enterprise.itmapping.feature.graph.domain.NeighborhoodDirection;
import com.enterprise.itmapping.feature.integrations.llm.MappingChatProperties;
import com.enterprise.itmapping.feature.rag.application.FunctionalDocSearchService;
import com.enterprise.itmapping.feature.rag.presentation.dto.FunctionalDocSearchResponse;
import com.enterprise.itmapping.feature.rag.presentation.dto.FunctionalDocSearchResponse.HitDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MappingChatToolsTest {

  @Mock ApplicationCatalogQuery catalogQuery;
  @Mock GraphNeighborhoodService neighborhoodService;
  @Mock ApplicationService applicationService;
  @Mock FunctionalDocumentationService documentationService;
  @Mock ModuleGraphService moduleGraphService;
  @Mock FunctionalDocSearchService docSearchService;
  @Mock GraphNodeFilterFacetService filterFacets;
  @Mock GraphService graphService;
  @Mock ApplicationNodeAttributePatchService nodeAttributes;
  @Mock ApplicationNodeRefPatchService nodeRefs;
  @Mock GraphEdgeAttributePatchService edgeAttributes;

  private final MappingChatProperties properties =
      new MappingChatProperties(true, 10, 50, 8000, 10, 10, 40);
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void resolveApplicationsAddsCitations() {
    when(catalogQuery.loadAllNamed())
        .thenReturn(List.of(new CatalogRow("a1", "Billing", "desc")));

    MappingChatTools tools = tools();
    String json = tools.resolveApplications("bill");

    assertThat(json).contains("Billing").contains("a1");
    assertThat(tools.citations()).hasSize(1);
    assertThat(tools.citations().get(0).type()).isEqualTo(ChatCitationType.APPLICATION);
  }

  @Test
  void getNeighborhoodCollectsEdgeAndAppCitations() {
    when(neighborhoodService.getNeighborhood(eq("a1"), eq(NeighborhoodDirection.BOTH), eq(50)))
        .thenReturn(
            new ApplicationNeighborhoodDto(
                new NeighborhoodApplicationDto("a1", "Billing", null),
                List.of(
                    new NeighborhoodEdgeDto(
                        "e1", "OUT", "a2", "CRM", Map.of("channel", "API"))),
                false));

    MappingChatTools tools = tools();
    String json = tools.getNeighborhood("a1", "BOTH");

    assertThat(json).contains("CRM").contains("API");
    assertThat(tools.citations().stream().map(c -> c.type()).toList())
        .contains(ChatCitationType.APPLICATION, ChatCitationType.EDGE);
  }

  @Test
  void searchFunctionalDocsAddsDocCitations() {
    when(docSearchService.search(eq("payments"), isNull(), isNull()))
        .thenReturn(
            new FunctionalDocSearchResponse(
                "payments",
                List.of(
                    new HitDto(
                        "a1",
                        "Billing",
                        "capability",
                        "Payments",
                        "Handles payments",
                        0.9)),
                "ok"));

    MappingChatTools tools = tools();
    String json = tools.searchFunctionalDocs("payments", null);

    assertThat(json).contains("Billing").contains("Payments");
    assertThat(tools.citations()).hasSize(1);
    assertThat(tools.citations().get(0).type()).isEqualTo(ChatCitationType.FUNCTIONAL_DOC);
  }

  @Test
  void serviceAskDelegatesToAgentAndReturnsCitations() {
    MappingChatAgent agent = org.mockito.Mockito.mock(MappingChatAgent.class);
    when(agent.ask(anyString(), any(), any())).thenReturn("Billing is connected to CRM.");

    MappingChatService service = chatService(agent);

    ChatAskResponse res = service.ask(new ChatAskRequest("Who is connected to Billing?", null));
    assertThat(res.answerMarkdown()).isEqualTo("Billing is connected to CRM.");
    assertThat(res.appliedFilters()).isNull();
    assertThat(res.graphChanged()).isFalse();
    verify(agent).ask(eq("Who is connected to Billing?"), eq(null), any(MappingChatTools.class));
  }

  @Test
  void serviceAskUsesAnEnglishFallbackWhenTheModelReturnsNothing() {
    MappingChatAgent agent = org.mockito.Mockito.mock(MappingChatAgent.class);
    when(agent.ask(anyString(), any(), any())).thenReturn("  ");

    ChatAskResponse res =
        chatService(agent).ask(new ChatAskRequest("Who is connected to Billing?", null));

    assertThat(res.answerMarkdown())
        .isEqualTo("I could not produce an answer. Try again or rephrase the question.");
  }

  @Test
  void serviceAskShowsTheModelTheFiltersOnTheMap() {
    MappingChatAgent agent = org.mockito.Mockito.mock(MappingChatAgent.class);
    when(agent.ask(anyString(), any(), any())).thenReturn("Done");
    MappingChatService service = chatService(agent);
    ChatMapFilters filters =
        new ChatMapFilters(List.of("a1"), Map.of("region", List.of("Europe")), Map.of(), Map.of());

    service.ask(new ChatAskRequest("Remove the region filter", null, filters));

    verify(agent)
        .ask(
            org.mockito.ArgumentMatchers.argThat(
                message ->
                    message.contains("Current map filters:") && message.contains("Europe")),
            eq(null),
            any(MappingChatTools.class));
  }

  @Test
  void askRequestReadsTheFiltersTheMapIsShowing() throws Exception {
    ChatAskRequest request =
        objectMapper.readValue(
            "{\"message\":\"Show Europe\",\"filters\":{\"applicationIds\":[\"a1\"],\"nodeAttributes\":{\"region\":[\"Europe\"]}}}",
            ChatAskRequest.class);

    assertThat(request.filters().applicationIds()).containsExactly("a1");
    assertThat(request.filters().nodeAttributes()).containsEntry("region", List.of("Europe"));
    assertThat(request.filters().nodeRefs()).isEmpty();
  }

  @Test
  void applyMapFiltersStoresCatalogueSpellingAndDropsUnknownValues() {
    when(filterFacets.listNodeFilters()).thenReturn(regionAndCountry());

    MappingChatTools tools = tools();
    String json =
        tools.applyMapFilters(
            "{\"nodeAttributes\":{\"region\":[\"europe\",\"Mars\"]},\"nodeRefs\":{\"Pays\":[\"Europe\"]},\"edgeAttributes\":{\"channel\":[\"api\"]}}");

    assertThat(json).contains("\"accepted\":true").contains("Mars");
    assertThat(tools.appliedFilters().nodeAttributes()).containsEntry("region", List.of("Europe"));
    assertThat(tools.appliedFilters().nodeRefs()).containsEntry("country", List.of("ref-eu"));
    assertThat(tools.appliedFilters().edgeAttributes()).containsEntry("channel", List.of("API"));
  }

  @Test
  void applyMapFiltersRefusesAnUnknownKeyOrADimensionWithNoValidValue() {
    when(filterFacets.listNodeFilters()).thenReturn(regionAndCountry());

    MappingChatTools tools = tools();
    tools.applyMapFilters("{\"nodeAttributes\":{\"region\":[\"Europe\"]}}");

    assertThat(tools.applyMapFilters("{\"nodeAttributes\":{\"nope\":[\"Europe\"]}}"))
        .contains("\"accepted\":false");
    assertThat(tools.appliedFilters().nodeAttributes()).containsEntry("region", List.of("Europe"));

    MappingChatTools fresh = tools();
    assertThat(fresh.applyMapFilters("{\"nodeAttributes\":{\"region\":[\"Mars\"]}}"))
        .contains("\"accepted\":false");
    assertThat(fresh.appliedFilters()).isNull();
  }

  @Test
  void applyMapFiltersRefusesAnAmbiguousApplicationAndClearsOnAnEmptyObject() {
    when(catalogQuery.loadAllNamed())
        .thenReturn(
            List.of(
                new CatalogRow("a1", "Alpha", null),
                new CatalogRow("b1", "Billing", null),
                new CatalogRow("b2", "Billpay", null)));
    when(filterFacets.listNodeFilters()).thenReturn(List.of());

    MappingChatTools tools = tools();
    assertThat(tools.applyMapFilters("{\"applicationIds\":[\"Bill\"]}")).contains("\"accepted\":false");
    assertThat(tools.appliedFilters()).isNull();

    assertThat(tools.applyMapFilters("{\"applicationIds\":[\"Alpha\"]}")).contains("\"accepted\":true");
    assertThat(tools.appliedFilters().applicationIds()).containsExactly("a1");

    assertThat(tools.applyMapFilters("{}")).contains("\"accepted\":true");
    assertThat(tools.appliedFilters().applicationIds()).isEmpty();
    assertThat(tools.appliedFilters().nodeAttributes()).isEmpty();
  }

  @Test
  void listFilterDimensionsReturnsTheDrawerDimensions() {
    when(filterFacets.listNodeFilters()).thenReturn(regionAndCountry());

    String json = tools().listFilterDimensions();

    assertThat(json).contains("region").contains("Pays").contains("ref-eu");
  }

  private static List<GraphNodeFilterDto> regionAndCountry() {
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
        new GraphNodeFilterDto("channel", "Channel", List.of("API", "FILE"), true, "EDGE", false, List.of()));
  }

  private MappingChatService chatService(MappingChatAgent agent) {
    return new MappingChatService(
        agent,
        properties,
        catalogQuery,
        neighborhoodService,
        applicationService,
        documentationService,
        moduleGraphService,
        docSearchService,
        filterFacets,
        graphService,
        nodeAttributes,
        nodeRefs,
        edgeAttributes,
        objectMapper,
        "sk-test");
  }

  private MappingChatTools tools() {
    return new MappingChatTools(
        catalogQuery,
        neighborhoodService,
        applicationService,
        documentationService,
            moduleGraphService,
            docSearchService,
            filterFacets,
            graphService,
            nodeAttributes,
            nodeRefs,
            edgeAttributes,
            properties,
            objectMapper);
  }
}
