package com.enterprise.itmapping.feature.applications.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.applications.application.ModuleSuggestionService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@WebMvcTest(controllers = ApplicationController.class)
class SuggestFromGithubConflictWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean ApplicationService applicationService;

  @MockBean ModuleGraphService moduleGraphService;

  @MockBean ModuleSuggestionService moduleSuggestionService;

  @Test
  void postSuggestFromGithubReturnsConflictWhenServiceSignals409() throws Exception {
    String appId = UUID.randomUUID().toString();
    when(moduleSuggestionService.suggestFromGithub(anyString(), any()))
        .thenThrow(
            new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Les modules ont déjà été suggérés pour cette application."));

    mockMvc
        .perform(
            post("/applications/{id}/modules/suggest-from-github", appId)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isConflict());
  }
}
