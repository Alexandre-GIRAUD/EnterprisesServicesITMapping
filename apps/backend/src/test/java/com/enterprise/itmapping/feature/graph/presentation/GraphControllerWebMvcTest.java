package com.enterprise.itmapping.feature.graph.presentation;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = GraphController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class GraphControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean GraphService graphService;

  @Test
  void getGraphForwardsApplicationIds() throws Exception {
    when(graphService.getGraph(isNull(), eq(List.of("app-1")), isNull(), isNull()))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(
            get("/graph")
                .param("applicationIds", "app-1")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraph(isNull(), eq(List.of("app-1")), isNull(), isNull());
  }

  @Test
  void getGraphForwardsLegacyBusinessUnitIdQueryParam() throws Exception {
    when(graphService.getGraph(isNull(), isNull(), eq(List.of("bu-abc")), isNull()))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(
            get("/graph")
                .param("businessUnitId", "bu-abc")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraph(isNull(), isNull(), eq(List.of("bu-abc")), isNull());
  }

  @Test
  void getGraphForwardsMultipleBusinessUnitIds() throws Exception {
    when(graphService.getGraph(isNull(), isNull(), eq(List.of("bu-1", "bu-2")), isNull()))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(
            get("/graph")
                .param("businessUnitIds", "bu-1", "bu-2")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraph(isNull(), isNull(), eq(List.of("bu-1", "bu-2")), isNull());
  }

  @Test
  void getGraphForwardsLegacyRegionCodeQueryParam() throws Exception {
    when(graphService.getGraph(isNull(), isNull(), isNull(), eq(List.of("EMEA"))))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(
            get("/graph").param("regionCode", "EMEA").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraph(isNull(), isNull(), isNull(), eq(List.of("EMEA")));
  }

  @Test
  void getGraphForwardsMultipleRegionCodes() throws Exception {
    when(graphService.getGraph(isNull(), isNull(), isNull(), eq(List.of("EMEA", "APAC"))))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(
            get("/graph")
                .param("regionCodes", "EMEA", "APAC")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraph(isNull(), isNull(), isNull(), eq(List.of("EMEA", "APAC")));
  }

  @Test
  void getGraphWithNoFilterParamsPassesNullLists() throws Exception {
    when(graphService.getGraph(isNull(), isNull(), isNull(), isNull()))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(get("/graph").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraph(isNull(), isNull(), isNull(), isNull());
  }

  @Test
  void getGraphAtDateForwardsBusinessUnitIds() throws Exception {
    String date = "2024-02-15T12:00:00Z";
    java.util.Date d = java.util.Date.from(java.time.Instant.parse(date));
    when(graphService.getGraphAtDate(eq(d), isNull(), eq(List.of("bu-xyz")), isNull()))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(
            get("/graph/at-date")
                .param("date", date)
                .param("businessUnitIds", "bu-xyz")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraphAtDate(eq(d), isNull(), eq(List.of("bu-xyz")), isNull());
  }

  @Test
  void getGraphAtDateForwardsRegionCodes() throws Exception {
    String date = "2024-02-15T12:00:00Z";
    java.util.Date d = java.util.Date.from(java.time.Instant.parse(date));
    when(graphService.getGraphAtDate(eq(d), isNull(), isNull(), eq(List.of("APAC"))))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(
            get("/graph/at-date")
                .param("date", date)
                .param("regionCodes", "APAC")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraphAtDate(eq(d), isNull(), isNull(), eq(List.of("APAC")));
  }
}
