package com.enterprise.itmapping.feature.datamodel.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class DataModelValidatorTest {

  private final DataModelValidator validator = new DataModelValidator();

  @Test
  void rejectsDuplicateKeys() {
    List<DataModelField> fields =
        List.of(
            new DataModelField("foo", "Foo", "", "", List.of(), false, false),
            new DataModelField("foo", "Foo 2", "", "", List.of(), false, false));

    assertThatThrownBy(() -> validator.validatePut(fields))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("doublon");
  }

  @Test
  void rejectsEnforceEnumWithoutAllowedValues() {
    List<DataModelField> fields =
        List.of(new DataModelField("foo", "Foo", "", "", List.of(), true, false));

    assertThatThrownBy(() -> validator.validatePut(fields))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("allowedValues");
  }

  @Test
  void rejectsReservedKey() {
    List<DataModelField> fields =
        List.of(new DataModelField("channel", "Channel", "", "", List.of(), false, false));

    assertThatThrownBy(() -> validator.validatePut(fields))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("reservee");
  }

  @Test
  void rejectsReservedNodeKey() {
    List<DataModelField> fields =
        List.of(
            new DataModelField(
                "name",
                "Name",
                "",
                "",
                List.of(),
                false,
                false,
                com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection
                    .AUTOMATIC_DETECTION,
                com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget.NODE));

    assertThatThrownBy(() -> validator.validatePut(fields))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("reservee");
  }

  @Test
  void rejectsNodeRefWithoutAllowedValues() {
    List<DataModelField> fields =
        List.of(
            new DataModelField(
                "tier_ref",
                "Tier",
                "",
                "",
                List.of(),
                false,
                false,
                com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection
                    .AUTOMATIC_DETECTION,
                com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget.NODE_REF));

    assertThatThrownBy(() -> validator.validatePut(fields))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("NODE_REF");
  }

  @Test
  void normalizeForcesEnforceEnumAndDropsMultipleForNonNodeRef() {
    var config =
        validator.normalize(
            List.of(
                new DataModelField(
                    "tier_ref",
                    "Tier",
                    "",
                    "",
                    List.of("GOLD"),
                    false,
                    false,
                    com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection
                        .AUTOMATIC_DETECTION,
                    com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget.NODE_REF,
                    true),
                new DataModelField(
                    "tier",
                    "Tier flat",
                    "",
                    "",
                    List.of("GOLD"),
                    false,
                    false,
                    com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection
                        .AUTOMATIC_DETECTION,
                    com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget.NODE,
                    true)));

    var nodeRef = config.fields().stream().filter(f -> f.key().equals("tier_ref")).findFirst().orElseThrow();
    var node = config.fields().stream().filter(f -> f.key().equals("tier")).findFirst().orElseThrow();
    org.assertj.core.api.Assertions.assertThat(nodeRef.enforceEnum()).isTrue();
    org.assertj.core.api.Assertions.assertThat(nodeRef.multiple()).isTrue();
    org.assertj.core.api.Assertions.assertThat(node.multiple()).isFalse();
  }
}
