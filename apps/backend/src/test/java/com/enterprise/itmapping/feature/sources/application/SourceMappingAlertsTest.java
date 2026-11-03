package com.enterprise.itmapping.feature.sources.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class SourceMappingAlertsTest {

  @Test
  void listsApplicationsWithoutAnyMappingForEachUsedSource() {
    Map<String, List<String>> alerts =
        SourceMappingAlerts.compute(
            Set.of("s1"), List.of("a1", "a2", "a3"), Map.of("s1", Set.of("a1", "a2")));

    assertThat(alerts).containsOnlyKeys("s1");
    assertThat(alerts.get("s1")).containsExactly("a3");
  }

  @Test
  void omitsFullyMappedSources() {
    assertThat(
            SourceMappingAlerts.compute(Set.of("s1"), List.of("a1"), Map.of("s1", Set.of("a1"))))
        .isEmpty();
  }
}
