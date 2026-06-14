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
import java.time.Instant;
import java.util.List;
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
                    new GraphSnapshotFiltersDto(2024, List.of("app-1"), List.of(), List.of("EMEA")),
                    Instant.parse("2026-01-01T00:00:00Z"),
                    Instant.parse("2026-01-02T00:00:00Z"))));

    mockMvc
        .perform(get("/users/me/graph-snapshots"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("Retail EMEA"))
        .andExpect(jsonPath("$[0].filters.year").value(2024));
  }

  @Test
  void createReturns201() throws Exception {
    UUID id = UUID.randomUUID();
    when(graphSnapshotService.create(any()))
        .thenReturn(
            new GraphSnapshotResponse(
                id,
                "Vue Retail",
                new GraphSnapshotFiltersDto(null, List.of("app-1"), List.of(), List.of()),
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
                        "year": null,
                        "applicationIds": ["app-1"],
                        "businessUnitIds": [],
                        "regionCodes": []
                      }
                    }
                    """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Vue Retail"));
  }

  @Test
  void deleteReturns204() throws Exception {
    UUID id = UUID.randomUUID();
    mockMvc
        .perform(delete("/users/me/graph-snapshots/{id}", id))
        .andExpect(status().isNoContent());
  }
}
