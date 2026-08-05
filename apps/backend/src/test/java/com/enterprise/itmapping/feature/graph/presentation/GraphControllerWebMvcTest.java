package com.enterprise.itmapping.feature.graph.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.graph.application.GraphNodeFilterFacetService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.List;
import java.util.Map;
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
  @MockBean GraphNodeFilterFacetService nodeFilterFacetService;

  @Test
  void getGraphForwardsApplicationIds() throws Exception {
    when(graphService.getGraph(eq(List.of("app-1")), any(), any(), any())).thenReturn(emptyGraph());

    mockMvc
        .perform(get("/graph").param("applicationIds", "app-1").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraph(eq(List.of("app-1")), eq(Map.of()), eq(Map.of()), eq(Map.of()));
  }

  @Test
  void getGraphForwardsLegacyApplicationIdQueryParam() throws Exception {
    when(graphService.getGraph(eq(List.of("app-9")), any(), any(), any())).thenReturn(emptyGraph());

    mockMvc
        .perform(get("/graph").param("applicationId", "app-9").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService).getGraph(eq(List.of("app-9")), eq(Map.of()), eq(Map.of()), eq(Map.of()));
  }

  @Test
  void getGraphForwardsNodeAttributeFiltersGroupedByKey() throws Exception {
    when(graphService.getGraph(isNull(), any(), any(), any())).thenReturn(emptyGraph());

    mockMvc
        .perform(
            get("/graph")
                .param("attr.tier", "GOLD", "SILVER")
                .param("attr.zone_x", "EMEA")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService)
        .getGraph(
            isNull(),
            eq(Map.of("tier", List.of("GOLD", "SILVER"), "zone_x", List.of("EMEA"))),
            eq(Map.of()),
            eq(Map.of()));
  }

  @Test
  void getGraphForwardsNodeRefFiltersGroupedByKey() throws Exception {
    when(graphService.getGraph(isNull(), any(), any(), any())).thenReturn(emptyGraph());

    mockMvc
        .perform(
            get("/graph")
                .param("ref.tier_ref", "id-a", "id-b")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService)
        .getGraph(
            isNull(),
            eq(Map.of()),
            eq(Map.of("tier_ref", List.of("id-a", "id-b"))),
            eq(Map.of()));
  }

  @Test
  void getGraphForwardsEdgeAttributeFiltersGroupedByKey() throws Exception {
    when(graphService.getGraph(isNull(), any(), any(), any())).thenReturn(emptyGraph());

    mockMvc
        .perform(
            get("/graph")
                .param("edge.data_category", "ORDER_PAYLOAD", "INVOICE")
                .param("edge.flow_nature", "SYNC")
                .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk());

    verify(graphService)
        .getGraph(
            isNull(),
            eq(Map.of()),
            eq(Map.of()),
            eq(
                Map.of(
                    "data_category",
                    List.of("ORDER_PAYLOAD", "INVOICE"),
                    "flow_nature",
                    List.of("SYNC"))));
  }

  @Test
  void getGraphWithNoFilterParamsPassesNoFilter() throws Exception {
    when(graphService.getGraph(isNull(), any(), any(), any())).thenReturn(emptyGraph());

    mockMvc.perform(get("/graph").accept(MediaType.APPLICATION_JSON)).andExpect(status().isOk());

    verify(graphService).getGraph(isNull(), eq(Map.of()), eq(Map.of()), eq(Map.of()));
  }

  @Test
  void nodeFiltersExposesDataModelDimensions() throws Exception {
    when(nodeFilterFacetService.listNodeFilters())
        .thenReturn(List.of(new GraphNodeFilterDto("tier", "Tier", List.of("GOLD"), true)));

    mockMvc
        .perform(get("/graph/node-filters").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].key").value("tier"))
        .andExpect(jsonPath("$[0].label").value("Tier"))
        .andExpect(jsonPath("$[0].values[0]").value("GOLD"))
        .andExpect(jsonPath("$[0].fromAllowedValues").value(true));
  }

  private static GraphResponseDto emptyGraph() {
    return new GraphResponseDto(List.of(), List.of());
  }
}
