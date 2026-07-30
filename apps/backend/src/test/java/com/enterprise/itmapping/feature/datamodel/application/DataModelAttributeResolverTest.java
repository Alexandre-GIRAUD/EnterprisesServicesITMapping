package com.enterprise.itmapping.feature.datamodel.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
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

  @Test
  void filtersByTarget_edgeIgnoresNodeKeys() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "product_line",
                    "Line",
                    "",
                    "",
                    List.of("A"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.EDGE),
                new DataModelField(
                    "tier",
                    "Tier",
                    "",
                    "",
                    List.of("T1"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE)));

    var edge =
        resolver.validate(
            config, Map.of("product_line", "A", "tier", "T1"), DataModelTarget.EDGE);
    var node =
        resolver.validate(
            config, Map.of("product_line", "A", "tier", "T1"), DataModelTarget.NODE);

    assertThat(edge.attributes()).containsExactly(Map.entry("product_line", "A"));
    assertThat(node.attributes()).containsExactly(Map.entry("tier", "T1"));
    assertThat(resolver.allowedKeys(config, DataModelTarget.EDGE)).isEqualTo(Set.of("product_line"));
    assertThat(resolver.allowedKeys(config, DataModelTarget.NODE)).isEqualTo(Set.of("tier"));
  }

  @Test
  void requiredNodeFieldMissingUsesNodeSkipReason() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "tier",
                    "Tier",
                    "",
                    "",
                    List.of(),
                    false,
                    true,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE)));

    var result = resolver.validate(config, Map.of(), DataModelTarget.NODE);

    assertThat(result.accepted()).isFalse();
    assertThat(result.skipReason()).isEqualTo("data_model_node_champ_manquant");
  }

  @Test
  void invalidNodeEnumUsesNodeSkipReason() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "tier",
                    "Tier",
                    "",
                    "",
                    List.of("T1"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE)));

    var result = resolver.validate(config, Map.of("tier", "BAD"), DataModelTarget.NODE);

    assertThat(result.accepted()).isFalse();
    assertThat(result.skipReason()).isEqualTo("data_model_node_valeur_invalide");
  }

  @Test
  void validateNodeRefsKeepsCatalogueMatchesAndSoftSkipsUnknown() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "tier_ref",
                    "Tier",
                    "",
                    "",
                    List.of("GOLD", "SILVER"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE_REF,
                    true)));

    var result =
        resolver.validateNodeRefs(
            config, Map.of("tier_ref", List.of("gold", "PLATINUM", "SILVER")));

    assertThat(result.accepted()).isTrue();
    assertThat(result.refs()).containsExactly(Map.entry("tier_ref", List.of("GOLD", "SILVER")));
  }

  @Test
  void validateNodeRefsHonoursMultipleFalse() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "tier_ref",
                    "Tier",
                    "",
                    "",
                    List.of("GOLD", "SILVER"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE_REF,
                    false)));

    var result =
        resolver.validateNodeRefs(config, Map.of("tier_ref", List.of("GOLD", "SILVER")));

    assertThat(result.accepted()).isTrue();
    assertThat(result.refs().get("tier_ref")).containsExactly("GOLD");
  }

  @Test
  void validateNodeRefsIgnoresManualFields() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "zone_x",
                    "Zone",
                    "",
                    "",
                    List.of("A"),
                    true,
                    false,
                    DataModelDetection.MANUAL,
                    DataModelTarget.NODE_REF)));

    var result = resolver.validateNodeRefs(config, Map.of("zone_x", List.of("A")));

    assertThat(result.accepted()).isTrue();
    assertThat(result.refs()).isEmpty();
  }
}
