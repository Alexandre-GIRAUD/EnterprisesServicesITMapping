package com.enterprise.itmapping.feature.breach.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class BreachNumberTest {

  @ParameterizedTest
  @CsvSource(
      delimiter = ';',
      value = {
        "120000;120000",
        "120 000;120000",
        "120k;120000",
        "120K;120000",
        "1.2M;1200000",
        "'1,2M';1200000",
        "-5;-5",
        "' 42.5 ';42.5",
        "100 k;100000",
        "120 000;120000",
        "120 000;120000"
      })
  void parsesNumbersWrittenByPeople(String raw, double expected) {
    assertThat(BreachNumber.parse(raw)).isEqualTo(expected);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "  ", "high", "12abc", "1.2.3", "k", "1,200,000"})
  void returnsNullWhenTheTextIsNotANumber(String raw) {
    assertThat(BreachNumber.parse(raw)).isNull();
  }

  @Test
  void returnsNullForNull() {
    assertThat(BreachNumber.parse(null)).isNull();
  }
}
