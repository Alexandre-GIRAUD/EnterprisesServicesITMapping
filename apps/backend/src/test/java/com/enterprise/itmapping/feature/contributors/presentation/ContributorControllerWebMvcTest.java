package com.enterprise.itmapping.feature.contributors.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.applications.presentation.dto.BusinessUnitSummary;
import com.enterprise.itmapping.feature.contributors.application.ContributorService;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorDetailResponse;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorLinkedApplicationDto;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorListItemDto;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorSummaryDto;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = ContributorController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class ContributorControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean ContributorService contributorService;

  @Test
  void listReturnsItems() throws Exception {
    when(contributorService.findAll())
        .thenReturn(
            List.of(new ContributorListItemDto("c1", "Alice", "Dupont", "Team A")));

    mockMvc
        .perform(get("/contributors").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("c1"))
        .andExpect(jsonPath("$[0].firstName").value("Alice"))
        .andExpect(jsonPath("$[0].team").value("Team A"));
  }

  @Test
  void getByIdReturnsDetail() throws Exception {
    ContributorDetailResponse detail =
        new ContributorDetailResponse(
            "c1",
            "Alice",
            "Dupont",
            "Team A",
            new BusinessUnitSummary("bu-1", "Retail", "R", null),
            new ContributorSummaryDto("m1", "Bob", "Martin"),
            List.of(new ContributorLinkedApplicationDto("app-1", "Portal")));
    when(contributorService.findById("c1")).thenReturn(Optional.of(detail));

    mockMvc
        .perform(get("/contributors/c1").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("c1"))
        .andExpect(jsonPath("$.businessUnit.id").value("bu-1"))
        .andExpect(jsonPath("$.manager.id").value("m1"))
        .andExpect(jsonPath("$.applications[0].id").value("app-1"));
  }

  @Test
  void getByIdReturns404() throws Exception {
    when(contributorService.findById("missing")).thenReturn(Optional.empty());
    mockMvc.perform(get("/contributors/missing")).andExpect(status().isNotFound());
  }

  @Test
  void createReturns201() throws Exception {
    ContributorDetailResponse created =
        new ContributorDetailResponse(
            "new-id",
            "Eve",
            "Noir",
            null,
            null,
            null,
            List.of());
    when(contributorService.create(any())).thenReturn(created);

    mockMvc
        .perform(
            post("/contributors")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .content(
                    "{\"firstName\":\"Eve\",\"lastName\":\"Noir\",\"team\":null,\"businessUnitId\":null,\"managerContributorId\":null,\"applicationIds\":[]}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value("new-id"));
  }

  @Test
  void updateReturns200() throws Exception {
    ContributorDetailResponse updated =
        new ContributorDetailResponse(
            "c1", "Alice", "Dupont", "T2", null, null, List.of());
    when(contributorService.update(eq("c1"), any())).thenReturn(Optional.of(updated));

    mockMvc
        .perform(
            put("/contributors/c1")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .content(
                    "{\"firstName\":\"Alice\",\"lastName\":\"Dupont\",\"team\":\"T2\",\"businessUnitId\":null,\"managerContributorId\":null,\"applicationIds\":[]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.team").value("T2"));
  }

  @Test
  void updateReturns404WhenMissing() throws Exception {
    when(contributorService.update(eq("missing"), any())).thenReturn(Optional.empty());
    mockMvc
        .perform(
            put("/contributors/missing")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"firstName\":\"X\",\"lastName\":\"Y\",\"applicationIds\":[]}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void deleteReturns204() throws Exception {
    when(contributorService.delete("c1")).thenReturn(true);
    mockMvc.perform(delete("/contributors/c1")).andExpect(status().isNoContent());
  }

  @Test
  void deleteReturns404() throws Exception {
    when(contributorService.delete("missing")).thenReturn(false);
    mockMvc.perform(delete("/contributors/missing")).andExpect(status().isNotFound());
  }
}
