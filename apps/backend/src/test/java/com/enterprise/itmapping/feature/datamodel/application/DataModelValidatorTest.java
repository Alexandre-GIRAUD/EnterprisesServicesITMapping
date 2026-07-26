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
}
