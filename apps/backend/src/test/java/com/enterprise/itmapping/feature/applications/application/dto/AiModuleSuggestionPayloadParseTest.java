package com.enterprise.itmapping.feature.applications.application.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** Golden JSON fixtures for IA shape (no HTTP). */
class AiModuleSuggestionPayloadParseTest {

  @Test
  void parsesGoldenFileAndNormalizesIdentifiers() throws Exception {
    byte[] raw = new ClassPathResource("ai-modules/golden-valid.json").getContentAsByteArray();
    AiModuleSuggestionPayload payload =
        new ObjectMapper().readValue(raw, AiModuleSuggestionPayload.class);

    assertThat(payload.getModules()).hasSize(2);
    assertThat(payload.getModules().get(0).getId()).isEqualTo("billing_module");
    assertThat(payload.getRelationships().get(0).getFromModuleId()).isEqualTo("billing_module");
    assertThat(payload.getRelationships().get(0).getToModuleId()).isEqualTo("catalog");
    assertThat(payload.getRelationships().get(0).getRelationshipKind())
        .isEqualTo("structural_contains");
    assertThat(payload.getRelationships().get(0).getEvidencePaths()).isNotEmpty();
  }
}
