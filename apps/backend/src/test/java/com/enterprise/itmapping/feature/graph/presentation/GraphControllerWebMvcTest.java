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
  void getGraphForwardsBusinessUnitIdQueryParam() throws Exception {
    when(graphService.getGraph(isNull(), eq("bu-abc")))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(
            get("/graph")
                .param("businessUnitId", "bu-abc")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraph(isNull(), eq("bu-abc"));
  }

  @Test
  void getGraphAtDateForwardsBusinessUnitId() throws Exception {
    String date = "2024-02-15T12:00:00Z";
    java.util.Date d = java.util.Date.from(java.time.Instant.parse(date));
    when(graphService.getGraphAtDate(eq(d), eq("bu-xyz")))
        .thenReturn(new GraphResponseDto(List.of(), List.of()));

    mockMvc
        .perform(
            get("/graph/at-date")
                .param("date", date)
                .param("businessUnitId", "bu-xyz")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraphAtDate(eq(d), eq("bu-xyz"));
  }
}
