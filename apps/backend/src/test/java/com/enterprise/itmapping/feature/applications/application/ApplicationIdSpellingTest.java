package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ApplicationIdSpellingTest {

  @Test
  void spacedAndPlainSpellingsMatchTheUnderscoreId() {
    String stored = ApplicationIdSpelling.compact("app_1");
    assertThat(ApplicationIdSpelling.compact("app 1")).isEqualTo(stored);
    assertThat(ApplicationIdSpelling.compact("app1")).isEqualTo(stored);
    assertThat(ApplicationIdSpelling.compact("APP_1")).isEqualTo(stored);
  }

  @Test
  void aDifferentNumberDoesNotMatch() {
    assertThat(ApplicationIdSpelling.compact("app 12"))
        .isNotEqualTo(ApplicationIdSpelling.compact("app_1"));
  }
}
