package com.enterprise.itmapping.feature.applications.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionSuggestionService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeRefPatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.applications.application.ModuleSuggestionService;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse.CreatedConnectionItem;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse.SkippedItem;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    controllers = ApplicationController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class)
class SuggestConnectionsFromGithubWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean ApplicationService applicationService;

  @MockBean ModuleGraphService moduleGraphService;

  @MockBean ModuleSuggestionService moduleSuggestionService;

  @MockBean ApplicationConnectionSuggestionService connectionSuggestionService;

  @MockBean ApplicationNodeAttributePatchService nodeAttributePatchService;

  @MockBean ApplicationNodeRefPatchService nodeRefPatchService;

  @Test
  void postSuggestConnectionsReturnsCreatedWithBody() throws Exception {
    String appId = UUID.randomUUID().toString();
    var response =
        new SuggestConnectionsFromGithubResponse(
            List.of(
                new CreatedConnectionItem(
                    "edge-1", appId, "peer-1", "Service B", "outbound", "KAFKA", "topic.x")),
            List.of(new SkippedItem("connection", "peer_inconnu", "Ghost App")),
            List.of("README.md"));
    when(connectionSuggestionService.suggestFromGithub(anyString(), any())).thenReturn(response);

    mockMvc
        .perform(
            post("/applications/{id}/connections/suggest-from-github", appId)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.created[0].edgeId").value("edge-1"))
        .andExpect(jsonPath("$.created[0].direction").value("outbound"))
        .andExpect(jsonPath("$.created[0].connectionKind").value("KAFKA"))
        .andExpect(jsonPath("$.skipped[0].reason").value("peer_inconnu"))
        .andExpect(jsonPath("$.analyzedFiles[0]").value("README.md"));
  }
}
