package com.enterprise.itmapping.feature.datamodel.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import java.util.List;
import org.junit.jupiter.api.Test;

class DataModelPromptBuilderTest {

  private final DataModelPromptBuilder builder = new DataModelPromptBuilder();

  @Test
  void emptyConfigReturnsEmptyString() {
    assertThat(builder.buildPromptSection(new DataModelConfig(List.of()))).isEmpty();
    assertThat(builder.buildPromptSection(null)).isEmpty();
  }

  @Test
  void buildsEdgeSectionWithFieldKeysAndAllowedValues() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "product_line",
                    "Ligne produit",
                    "Ce qui transite",
                    "Chercher dans topics",
                    List.of("ALPHA", "BETA"),
                    true,
                    false),
                new DataModelField(
                    "flow_nature",
                    "Nature du flux",
                    "",
                    "",
                    List.of(),
                    false,
                    true)));

    String section = builder.buildPromptSection(config);

    assertThat(section).contains("## Active Data Model (edge enrichment)");
    assertThat(section).doesNotContain("application node enrichment");
    assertThat(section).contains("Field key: product_line");
    assertThat(section).contains("Field key: flow_nature");
    assertThat(section).contains("ALPHA | BETA");
    assertThat(section).contains("STRICT:");
    assertThat(section).contains("REQUIRED:");
    assertThat(section).doesNotContain("EQUITY");
    assertThat(section).doesNotContain("RATES");
  }

  @Test
  void buildsNodeSectionOnly() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "criticality",
                    "Criticality",
                    "Business criticality",
                    "Look in README",
                    List.of("HIGH", "LOW"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE)));

    String section = builder.buildPromptSection(config);

    assertThat(section).contains("## Active Data Model (application node enrichment)");
    assertThat(section).doesNotContain("edge enrichment");
    assertThat(section).contains("Field key: criticality");
    assertThat(section).contains("node_attributes");
    assertThat(section).contains("Do not put node fields into edge_attributes");
  }

  @Test
  void buildsBothSectionsWhenMix() {
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

    String section = builder.buildPromptSection(config);

    assertThat(section).contains("## Active Data Model (edge enrichment)");
    assertThat(section).contains("## Active Data Model (application node enrichment)");
    assertThat(section).contains("Field key: product_line");
    assertThat(section).contains("Field key: tier");
    int edgeIdx = section.indexOf("edge enrichment");
    int nodeIdx = section.indexOf("application node enrichment");
    int productIdx = section.indexOf("product_line");
    int tierIdx = section.indexOf("Field key: tier");
    assertThat(productIdx).isGreaterThan(edgeIdx).isLessThan(nodeIdx);
    assertThat(tierIdx).isGreaterThan(nodeIdx);
  }

  @Test
  void threeFieldsIncludeAllKeys() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(field("a_key", "A"), field("b_key", "B"), field("c_key", "C")));

    String section = builder.buildPromptSection(config);

    assertThat(section).contains("a_key").contains("b_key").contains("c_key");
  }

  @Test
  void mixesAutomaticAndManual_listsOnlyAutomatic() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "auto_key",
                    "Auto",
                    "",
                    "",
                    List.of("X"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION),
                new DataModelField(
                    "manual_key",
                    "Manual",
                    "",
                    "",
                    List.of("Y"),
                    false,
                    true,
                    DataModelDetection.MANUAL)));

    String section = builder.buildPromptSection(config);

    assertThat(section).contains("Field key: auto_key");
    assertThat(section).contains("X");
    assertThat(section).doesNotContain("manual_key");
    assertThat(section).doesNotContain("Manual");
  }

  @Test
  void allManualFields_returnsEmptySection() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "a", "A", "", "", List.of(), false, true, DataModelDetection.MANUAL),
                new DataModelField(
                    "b",
                    "B",
                    "",
                    "",
                    List.of(),
                    false,
                    false,
                    DataModelDetection.MANUAL,
                    DataModelTarget.NODE)));

    assertThat(builder.buildPromptSection(config)).isEmpty();
  }

  @Test
  void doesNotLeakKeysAcrossSections() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "edge_only",
                    "E",
                    "",
                    "",
                    List.of(),
                    false,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.EDGE),
                new DataModelField(
                    "node_only",
                    "N",
                    "",
                    "",
                    List.of(),
                    false,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE)));

    String section = builder.buildPromptSection(config);
    String edgePart =
        section.substring(
            section.indexOf("edge enrichment"), section.indexOf("application node enrichment"));
    String nodePart = section.substring(section.indexOf("application node enrichment"));

    assertThat(edgePart).contains("edge_only").doesNotContain("node_only");
    assertThat(nodePart).contains("node_only").doesNotContain("edge_only");
  }

  @Test
  void buildsNodeRefSectionWithClosedCatalogue() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "tier_ref",
                    "Tier ref",
                    "",
                    "Pick from catalogue",
                    List.of("GOLD", "SILVER"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE_REF,
                    true)));

    String section = builder.buildPromptSection(config);

    assertThat(section).contains("NODE_REF");
    assertThat(section).contains("node_refs");
    assertThat(section).contains("tier_ref");
    assertThat(section).contains("GOLD");
    assertThat(section).contains("SILVER");
  }

  private static DataModelField field(String key, String label) {
    return new DataModelField(key, label, "", "", List.of(), false, false);
  }
}
