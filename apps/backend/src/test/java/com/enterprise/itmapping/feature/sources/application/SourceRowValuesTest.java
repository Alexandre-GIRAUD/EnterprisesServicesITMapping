package com.enterprise.itmapping.feature.sources.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SourceRowValuesTest {

  private final List<Map<String, Object>> rows =
      List.of(
          Map.of("ref", "app__1", "reg", "EMEA", "owner", "bob"),
          Map.of("ref", "app__2", "reg", "APAC"));

  @Test
  void findsTheRowByKeyColumnIgnoringCase() {
    assertThat(SourceRowValues.findRow(rows, "ref", "APP__2")).containsEntry("reg", "APAC");
    assertThat(SourceRowValues.findRow(rows, "ref", "nope")).isEmpty();
  }

  @Test
  void extractsOnlyMappedColumnsPresentInTheRow() {
    Map<String, Object> values =
        SourceRowValues.extract(
            rows.get(1), Map.of("region", "reg", "owner", "owner", "tier", "tier"));

    assertThat(values).containsOnlyKeys("region").containsEntry("region", "APAC");
  }
}
