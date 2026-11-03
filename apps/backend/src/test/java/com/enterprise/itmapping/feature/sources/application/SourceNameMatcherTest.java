package com.enterprise.itmapping.feature.sources.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SourceNameMatcherTest {

  @Test
  void normalizeKeepsLowercaseAlphanumericsOnly() {
    assertThat(SourceNameMatcher.normalize("App__1")).isEqualTo("app1");
    assertThat(SourceNameMatcher.normalize(" app 1 ")).isEqualTo("app1");
  }

  @Test
  void suggestsKeyWhoseNormalizedFormEqualsTheApplicationName() {
    Map<String, String> suggestions =
        SourceNameMatcher.suggest(
            Map.of("a1", "app1", "a2", "Billing"), List.of("app__1", "BILLING", "other"));

    assertThat(suggestions).containsEntry("a1", "app__1").containsEntry("a2", "BILLING");
  }

  @Test
  void ignoresAmbiguousAndMissingMatches() {
    Map<String, String> suggestions =
        SourceNameMatcher.suggest(
            Map.of("a1", "app1", "a2", "unknown"), List.of("app__1", "app-1"));

    assertThat(suggestions).isEmpty();
  }
}
