package com.enterprise.itmapping.feature.graphsnapshot.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.graphsnapshot.application.GraphSnapshotService;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphSnapshotFiltersDto;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphSnapshotResponse;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.NodePositionDto;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = GraphSnapshotController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class GraphSnapshotControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean GraphSnapshotService graphSnapshotService;

  @Test
  void listReturnsSnapshots() throws Exception {
    UUID id = UUID.randomUUID();
    when(graphSnapshotService.listForCurrentUser())
        .thenReturn(
            List.of(
                new GraphSnapshotResponse(
                    id,
                    "Retail EMEA",
                    new GraphSnapshotFiltersDto(
                        List.of("app-1"),
                        Map.of("region", List.of("EMEA")),
                        Map.of(),
                        List.of("app-2"),
                        Map.of("app-1", new NodePositionDto(10, 20))),
                    Instant.parse("2026-01-01T00:00:00Z"),
                    Instant.parse("2026-01-02T00:00:00Z"))));

    mockMvc
        .perform(get("/users/me/graph-snapshots"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("Retail EMEA"))
        .andExpect(jsonPath("$[0].filters.applicationIds[0]").value("app-1"))
        .andExpect(jsonPath("$[0].filters.nodeAttributes.region[0]").value("EMEA"))
        .andExpect(jsonPath("$[0].filters.hiddenApplicationIds[0]").value("app-2"))
        .andExpect(jsonPath("$[0].filters.nodePositions['app-1'].x").value(10));
  }

  @Test
  void createReturns201() throws Exception {
    UUID id = UUID.randomUUID();
    when(graphSnapshotService.create(any()))
        .thenReturn(
            new GraphSnapshotResponse(
                id,
                "Vue Retail",
                new GraphSnapshotFiltersDto(
                    List.of("app-1"),
                    Map.of("tier", List.of("GOLD")),
                    Map.of(),
                    List.of("app-9"),
                    Map.of("app-1", new NodePositionDto(40, 80))),
                Instant.parse("2026-01-01T00:00:00Z"),
                Instant.parse("2026-01-01T00:00:00Z")));

    mockMvc
        .perform(
            post("/users/me/graph-snapshots")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "Vue Retail",
                      "filters": {
                        "applicationIds": ["app-1"],
                        "nodeAttributes": { "tier": ["GOLD"] },
                        "hiddenApplicationIds": ["app-9"],
                        "nodePositions": { "app-1": { "x": 40, "y": 80 } }
                      }
                    }
                    """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Vue Retail"))
        .andExpect(jsonPath("$.filters.hiddenApplicationIds[0]").value("app-9"))
        .andExpect(jsonPath("$.filters.nodePositions['app-1'].y").value(80));
  }

  @Test
  void deleteReturns204() throws Exception {
    UUID id = UUID.randomUUID();
    mockMvc
        .perform(delete("/users/me/graph-snapshots/{id}", id))
        .andExpect(status().isNoContent());
  }
}
