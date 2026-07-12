package com.enterprise.itmapping.feature.applications.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionSuggestionService;
import com.enterprise.itmapping.feature.applications.application.ApplicationRegionLinkService;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.applications.application.ModuleSuggestionService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.RegionSummary;
import com.enterprise.itmapping.feature.businessunit.application.BusinessUnitApplicationLinkService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@WebMvcTest(controllers = ApplicationController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class ApplicationControllerRegionsWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean ApplicationService applicationService;

  @MockBean ModuleGraphService moduleGraphService;

  @MockBean ModuleSuggestionService moduleSuggestionService;

  @MockBean ApplicationConnectionSuggestionService connectionSuggestionService;

  @MockBean BusinessUnitApplicationLinkService businessUnitApplicationLinkService;

  @MockBean ApplicationRegionLinkService applicationRegionLinkService;

  @Test
  void patchRegionsReturnsUpdatedApplication() throws Exception {
    when(applicationRegionLinkService.setRegionsForApplication(eq("app-1"), any()))
        .thenReturn(true);
    ApplicationResponse body =
        new ApplicationResponse(
            "app-1",
            "App",
            "",
            2024,
            false,
            null,
            List.of(),
            List.of(new RegionSummary("rid", "EMEA", "EU")));
    when(applicationService.findById(eq("app-1"))).thenReturn(Optional.of(body));

    mockMvc
        .perform(
            patch("/applications/app-1/regions")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .content("{\"regionCodes\":[\"EMEA\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("app-1"))
        .andExpect(jsonPath("$.regions[0].code").value("EMEA"));
  }

  @Test
  void patchRegionsReturns400WhenUnknownCode() throws Exception {
    when(applicationRegionLinkService.setRegionsForApplication(eq("app-1"), any()))
        .thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Region"));

    mockMvc
        .perform(
            patch("/applications/app-1/regions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"regionCodes\":[\"NOPE\"]}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void patchRegionsReturns404WhenApplicationMissing() throws Exception {
    when(applicationRegionLinkService.setRegionsForApplication(eq("missing"), any()))
        .thenReturn(false);

    mockMvc
        .perform(
            patch("/applications/missing/regions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"regionCodes\":[\"EMEA\"]}"))
        .andExpect(status().isNotFound());
  }
}
