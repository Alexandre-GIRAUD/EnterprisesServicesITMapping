package com.enterprise.itmapping.feature.datamodel.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelFieldDto;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = DataModelController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class DataModelControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean DataModelService dataModelService;

  @Test
  void getReturnsFields() throws Exception {
    when(dataModelService.get())
        .thenReturn(
            new DataModelResponse(
                List.of(
                    new DataModelFieldDto(
                        "product_line", "Ligne produit", "", "", List.of("A"), true, false)),
                Instant.parse("2026-01-01T00:00:00Z")));

    mockMvc
        .perform(get("/data-model"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.fields[0].key").value("product_line"))
        .andExpect(jsonPath("$.updatedAt").exists());
  }

  @Test
  void putReturnsUpdatedConfig() throws Exception {
    when(dataModelService.replace(any()))
        .thenReturn(
            new DataModelResponse(
                List.of(
                    new DataModelFieldDto(
                        "flow_nature",
                        "Nature",
                        "d",
                        "h",
                        List.of(),
                        false,
                        true,
                        com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection.MANUAL)),
                Instant.parse("2026-01-02T00:00:00Z")));

    mockMvc
        .perform(
            put("/data-model")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "fields": [
                        {
                          "key": "flow_nature",
                          "label": "Nature",
                          "description": "d",
                          "promptHint": "h",
                          "allowedValues": [],
                          "enforceEnum": false,
                          "required": true,
                          "detection": "MANUAL"
                        }
                      ]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.fields[0].required").value(true))
        .andExpect(jsonPath("$.fields[0].detection").value("MANUAL"));
  }

  @Test
  void promptPreviewReturnsSection() throws Exception {
    when(dataModelService.buildPromptSection()).thenReturn("## Active Data Model");

    mockMvc
        .perform(get("/data-model/prompt-preview"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.promptSection").value("## Active Data Model"));
  }
}
