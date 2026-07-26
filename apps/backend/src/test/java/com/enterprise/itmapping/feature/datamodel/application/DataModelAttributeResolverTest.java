package com.enterprise.itmapping.feature.datamodel.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class DataModelAttributeResolverTest {

  private final DataModelAttributeResolver resolver = new DataModelAttributeResolver();

  @Test
  void stripsManualKeyEvenIfLlmReturnsIt() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "product_line",
                    "Ligne",
                    "",
                    "",
                    List.of("ALPHA"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION),
                new DataModelField(
                    "owner_note",
                    "Note",
                    "",
                    "",
                    List.of(),
                    false,
                    true,
                    DataModelDetection.MANUAL)));

    var result =
        resolver.validate(
            config, Map.of("product_line", "ALPHA", "owner_note", "should-be-stripped"));

    assertThat(result.accepted()).isTrue();
    assertThat(result.attributes()).containsExactly(Map.entry("product_line", "ALPHA"));
    assertThat(resolver.allowedKeys(config)).isEqualTo(Set.of("product_line"));
  }

  @Test
  void requiredOnManualFieldDoesNotSkipConnection() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "owner_note",
                    "Note",
                    "",
                    "",
                    List.of(),
                    false,
                    true,
                    DataModelDetection.MANUAL)));

    var result = resolver.validate(config, Map.of());

    assertThat(result.accepted()).isTrue();
    assertThat(result.attributes()).isEmpty();
    assertThat(resolver.allowedKeys(config)).isEmpty();
  }

  @Test
  void requiredOnAutomaticFieldStillSkipsWhenMissing() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "flow_nature",
                    "Nature",
                    "",
                    "",
                    List.of(),
                    false,
                    true,
                    DataModelDetection.AUTOMATIC_DETECTION)));

    var result = resolver.validate(config, Map.of());

    assertThat(result.accepted()).isFalse();
    assertThat(result.skipReason()).isEqualTo("data_model_champ_manquant");
  }

  @Test
  void missingDetectionDefaultsToAutomaticBehavior() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(new DataModelField("product_line", "Ligne", "", "", List.of("A"), true, false)));

    var result = resolver.validate(config, Map.of("product_line", "a"));

    assertThat(result.accepted()).isTrue();
    assertThat(result.attributes()).containsEntry("product_line", "A");
  }
}
