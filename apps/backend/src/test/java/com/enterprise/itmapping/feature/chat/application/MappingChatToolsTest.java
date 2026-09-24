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
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskRequest;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse;
import com.enterprise.itmapping.feature.functionaldoc.application.FunctionalDocumentationService;
import com.enterprise.itmapping.feature.graph.application.GraphNeighborhoodService;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto.NeighborhoodApplicationDto;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto.NeighborhoodEdgeDto;
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

  private final MappingChatProperties properties =
      new MappingChatProperties(true, 10, 50, 8000, 10, 10, 40);
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void resolveApplicationsAddsCitations() {
    when(catalogQuery.loadMatching("bill", 10))
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
    when(agent.ask(anyString(), any(), any())).thenReturn("Réponse test");

    MappingChatService service =
        new MappingChatService(
            agent,
            properties,
            catalogQuery,
            neighborhoodService,
            applicationService,
            documentationService,
            moduleGraphService,
            docSearchService,
            objectMapper,
            "sk-test");

    ChatAskResponse res = service.ask(new ChatAskRequest("Qui est connecté à Billing ?", null));
    assertThat(res.answerMarkdown()).isEqualTo("Réponse test");
    verify(agent).ask(eq("Qui est connecté à Billing ?"), eq(null), any(MappingChatTools.class));
  }

  private MappingChatTools tools() {
    return new MappingChatTools(
        catalogQuery,
        neighborhoodService,
        applicationService,
        documentationService,
        moduleGraphService,
        docSearchService,
        properties,
        objectMapper);
  }
}
