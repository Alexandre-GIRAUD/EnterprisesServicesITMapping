package com.enterprise.itmapping.feature.applications.presentation;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.applications.application.ModuleSuggestionService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.BusinessUnitSummary;
import com.enterprise.itmapping.feature.businessunit.application.BusinessUnitApplicationLinkService;
import java.time.Instant;
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
class ApplicationControllerBusinessUnitWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean ApplicationService applicationService;

  @MockBean ModuleGraphService moduleGraphService;

  @MockBean ModuleSuggestionService moduleSuggestionService;

  @MockBean BusinessUnitApplicationLinkService businessUnitApplicationLinkService;

  @Test
  void patchBusinessUnitReturnsUpdatedApplication() throws Exception {
    when(businessUnitApplicationLinkService.setBusinessUnitForApplication(eq("app-1"), eq("bu-1")))
        .thenReturn(true);
    ApplicationResponse body =
        new ApplicationResponse(
            "app-1",
            "App",
            "",
            Instant.parse("2024-01-01T00:00:00Z"),
            null,
            false,
            new BusinessUnitSummary("bu-1", "BU One", "B1", null),
            List.of());
    when(applicationService.findById(eq("app-1"), any())).thenReturn(Optional.of(body));

    mockMvc
        .perform(
            patch("/applications/app-1/business-unit")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .content("{\"businessUnitId\":\"bu-1\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("app-1"))
        .andExpect(jsonPath("$.businessUnit.id").value("bu-1"));
  }

  @Test
  void patchBusinessUnitWithNullClearsLink() throws Exception {
    when(businessUnitApplicationLinkService.setBusinessUnitForApplication(eq("app-1"), eq(null)))
        .thenReturn(true);
    ApplicationResponse body =
        new ApplicationResponse(
            "app-1", "App", "", Instant.parse("2024-01-01T00:00:00Z"), null, false, null, List.of());
    when(applicationService.findById(eq("app-1"), any())).thenReturn(Optional.of(body));

    mockMvc
        .perform(
            patch("/applications/app-1/business-unit")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .content("{\"businessUnitId\":null}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.businessUnit").value(nullValue()));
  }

  @Test
  void patchBusinessUnitReturns404WhenApplicationMissing() throws Exception {
    when(businessUnitApplicationLinkService.setBusinessUnitForApplication(eq("missing"), eq("bu-1")))
        .thenReturn(false);

    mockMvc
        .perform(
            patch("/applications/missing/business-unit")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"businessUnitId\":\"bu-1\"}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void patchBusinessUnitReturns404WhenBuUnknown() throws Exception {
    when(businessUnitApplicationLinkService.setBusinessUnitForApplication(eq("app-1"), eq("no-bu")))
        .thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "x"));

    mockMvc
        .perform(
            patch("/applications/app-1/business-unit")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"businessUnitId\":\"no-bu\"}"))
        .andExpect(status().isNotFound());
  }
}
