package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class AiDecisionSourceServiceTest {

  @Test
  void groundKeepsCitedPathsTheToolsActuallySaw() {
    assertThat(
            AiDecisionSourceService.ground(
                List.of(
                    "./src/A.java",
                    "src/A.java",
                    "../etc/passwd",
                    "/etc/passwd",
                    "src/Missing.java",
                    "src/B.java"),
                List.of("src/A.java", "src/B.java", "README.md")))
        .containsExactly("src/A.java", "src/B.java");
  }

  @Test
  void groundStopsAfterTwentyPathsInCitationOrder() {
    List<String> cited = new ArrayList<>();
    for (int index = 0; index < 25; index++) {
      cited.add("src/F" + index + ".java");
    }

    assertThat(AiDecisionSourceService.ground(cited, cited)).hasSize(20);
    assertThat(AiDecisionSourceService.ground(cited, cited).get(0)).isEqualTo("src/F0.java");
    assertThat(AiDecisionSourceService.ground(cited, cited).get(19)).isEqualTo("src/F19.java");
  }

  @Test
  void groundDropsEverythingWhenNothingWasObserved() {
    assertThat(AiDecisionSourceService.ground(List.of("src/A.java"), List.of())).isEmpty();
  }
}
