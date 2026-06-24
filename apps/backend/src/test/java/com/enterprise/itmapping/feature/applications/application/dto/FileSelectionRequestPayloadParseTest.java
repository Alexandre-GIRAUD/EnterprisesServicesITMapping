package com.enterprise.itmapping.feature.applications.application.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** Golden JSON fixtures for the file-selection (Pass 1) shape (no HTTP). */
class FileSelectionRequestPayloadParseTest {

  @Test
  void parsesGoldenFileTrimmingAndDroppingBlanks() throws Exception {
    byte[] raw = new ClassPathResource("ai-modules/file-selection-golden.json").getContentAsByteArray();
    FileSelectionRequestPayload payload =
        new ObjectMapper().readValue(raw, FileSelectionRequestPayload.class);

    assertThat(payload.isDone()).isFalse();
    assertThat(payload.getFilesToRead()).containsExactly("apps/billing/src/index.ts", "pom.xml");
  }

  @Test
  void unknownFieldsAreIgnoredAndDefaultsAreNullSafe() throws Exception {
    String json = "{\"unexpected\":42}";
    FileSelectionRequestPayload payload =
        new ObjectMapper().readValue(json, FileSelectionRequestPayload.class);

    assertThat(payload.isDone()).isFalse();
    assertThat(payload.getFilesToRead()).isEmpty();
  }
}
