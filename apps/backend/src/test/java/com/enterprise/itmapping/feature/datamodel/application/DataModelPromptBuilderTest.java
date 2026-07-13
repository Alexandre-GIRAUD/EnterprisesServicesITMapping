package com.enterprise.itmapping.feature.datamodel.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
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
  void buildsSectionWithFieldKeysAndAllowedValues() {
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

    assertThat(section).contains("## Active Data Model");
    assertThat(section).contains("Field key: product_line");
    assertThat(section).contains("Field key: flow_nature");
    assertThat(section).contains("ALPHA | BETA");
    assertThat(section).contains("STRICT:");
    assertThat(section).contains("REQUIRED:");
    assertThat(section).doesNotContain("EQUITY");
    assertThat(section).doesNotContain("RATES");
  }

  @Test
  void threeFieldsIncludeAllKeys() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                field("a_key", "A"),
                field("b_key", "B"),
                field("c_key", "C")));

    String section = builder.buildPromptSection(config);

    assertThat(section).contains("a_key").contains("b_key").contains("c_key");
  }

  private static DataModelField field(String key, String label) {
    return new DataModelField(key, label, "", "", List.of(), false, false);
  }
}
