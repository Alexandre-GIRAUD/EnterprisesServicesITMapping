package com.enterprise.itmapping.feature.breach.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.enterprise.itmapping.feature.breach.domain.BreachCombinator;
import com.enterprise.itmapping.feature.breach.domain.BreachCondition;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachGroup;
import com.enterprise.itmapping.feature.breach.domain.BreachOperator;
import com.enterprise.itmapping.feature.breach.domain.BreachScope;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class BreachRuleValidatorTest {

  private static final DataModelConfig MODEL =
      new DataModelConfig(
          List.of(
              field("cost", DataModelTarget.NODE),
              field("domain", DataModelTarget.NODE_REF),
              field("protocol", DataModelTarget.EDGE)));

  private final BreachRuleValidator validator = new BreachRuleValidator();

  private static DataModelField field(String key, DataModelTarget target) {
    return new DataModelField(
        key, key, "", "", List.of(), false, false, DataModelDetection.MANUAL, target, false);
  }

  private static BreachDefinition oneCondition(BreachCondition condition) {
    return new BreachDefinition(
        BreachCombinator.AND, List.of(new BreachGroup(BreachCombinator.AND, List.of(condition))));
  }

  private void validate(String name, BreachSubject subject, BreachDefinition definition) {
    validator.validate(name, subject, definition, MODEL, Set.of("Existing"));
  }

  @Test
  void acceptsAValidCrossRule() {
    BreachDefinition definition =
        new BreachDefinition(
            BreachCombinator.AND,
            List.of(
                new BreachGroup(
                    BreachCombinator.AND,
                    List.of(
                        new BreachCondition(BreachScope.FLOW, "protocol", BreachOperator.EQUALS, "FTP"),
                        new BreachCondition(
                            BreachScope.SOURCE_OR_TARGET, "cost", BreachOperator.GREATER_THAN, "100k"),
                        new BreachCondition(BreachScope.SOURCE, "domain", BreachOperator.IS_EMPTY, null)))));

    assertThatCode(() -> validate("FTP to expensive apps", BreachSubject.FLOW, definition))
        .doesNotThrowAnyException();
  }

  @Test
  void refusesAMissingOrDuplicateName() {
    BreachDefinition definition =
        oneCondition(new BreachCondition(BreachScope.SELF, "cost", BreachOperator.IS_EMPTY, null));

    assertThatThrownBy(() -> validate(" ", BreachSubject.APPLICATION, definition))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("name");
    assertThatThrownBy(() -> validate("existing", BreachSubject.APPLICATION, definition))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("already");
  }

  @Test
  void refusesAScopeThatDoesNotFitTheSubject() {
    assertThatThrownBy(
            () ->
                validate(
                    "r",
                    BreachSubject.APPLICATION,
                    oneCondition(new BreachCondition(BreachScope.SOURCE, "cost", BreachOperator.IS_EMPTY, null))))
        .hasMessageContaining("SOURCE");
  }

  @Test
  void refusesAnAttributeOutsideTheDataModelOrOfTheWrongTarget() {
    assertThatThrownBy(
            () ->
                validate(
                    "r",
                    BreachSubject.APPLICATION,
                    oneCondition(new BreachCondition(BreachScope.SELF, "unknown", BreachOperator.IS_EMPTY, null))))
        .hasMessageContaining("unknown");
    assertThatThrownBy(
            () ->
                validate(
                    "r",
                    BreachSubject.APPLICATION,
                    oneCondition(
                        new BreachCondition(BreachScope.SELF, "protocol", BreachOperator.IS_EMPTY, null))))
        .hasMessageContaining("protocol");
  }

  @Test
  void refusesAMissingValueOrANonNumericThreshold() {
    assertThatThrownBy(
            () ->
                validate(
                    "r",
                    BreachSubject.APPLICATION,
                    oneCondition(new BreachCondition(BreachScope.SELF, "cost", BreachOperator.EQUALS, " "))))
        .hasMessageContaining("value");
    assertThatThrownBy(
            () ->
                validate(
                    "r",
                    BreachSubject.APPLICATION,
                    oneCondition(
                        new BreachCondition(BreachScope.SELF, "cost", BreachOperator.GREATER_THAN, "a lot"))))
        .hasMessageContaining("number");
  }

  @Test
  void refusesEmptyOrOversizedTrees() {
    assertThatThrownBy(
            () ->
                validate(
                    "r", BreachSubject.APPLICATION, new BreachDefinition(BreachCombinator.AND, List.of())))
        .hasMessageContaining("group");
    assertThatThrownBy(
            () ->
                validate(
                    "r",
                    BreachSubject.APPLICATION,
                    new BreachDefinition(
                        BreachCombinator.AND,
                        List.of(new BreachGroup(BreachCombinator.AND, List.of())))))
        .hasMessageContaining("condition");
    BreachCondition condition = new BreachCondition(BreachScope.SELF, "cost", BreachOperator.IS_EMPTY, null);
    assertThatThrownBy(
            () ->
                validate(
                    "r",
                    BreachSubject.APPLICATION,
                    new BreachDefinition(
                        BreachCombinator.AND,
                        List.of(new BreachGroup(BreachCombinator.AND, Collections.nCopies(21, condition))))))
        .hasMessageContaining("20");
  }
}
