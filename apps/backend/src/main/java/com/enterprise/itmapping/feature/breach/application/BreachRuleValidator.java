package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.breach.domain.BreachCondition;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachGroup;
import com.enterprise.itmapping.feature.breach.domain.BreachNumber;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Refuses a rule the evaluator could not read; every message names the faulty part. */
@Component
public class BreachRuleValidator {

  static final int MAX_NAME_LENGTH = 120;
  static final int MAX_ITEMS = 20;

  /**
   * @param otherRuleNames names of the other rules (the edited rule excluded), compared ignoring case
   */
  public void validate(
      String name,
      BreachSubject subject,
      BreachDefinition definition,
      DataModelConfig model,
      Set<String> otherRuleNames) {
    validateName(name, otherRuleNames);
    if (subject == null) {
      throw badRequest("A rule needs a subject (APPLICATION or FLOW).");
    }
    if (definition == null || definition.combinator() == null) {
      throw badRequest("A rule needs a combinator between its groups.");
    }
    List<BreachGroup> groups = definition.groups();
    if (groups.isEmpty()) {
      throw badRequest("A rule needs at least one group.");
    }
    if (groups.size() > MAX_ITEMS) {
      throw badRequest("A rule holds at most " + MAX_ITEMS + " groups.");
    }
    for (BreachGroup group : groups) {
      validateGroup(group, subject, model);
    }
  }

  private static void validateName(String name, Set<String> otherRuleNames) {
    if (!StringUtils.hasText(name)) {
      throw badRequest("A rule needs a name.");
    }
    String trimmed = name.trim();
    if (trimmed.length() > MAX_NAME_LENGTH) {
      throw badRequest("A rule name holds at most " + MAX_NAME_LENGTH + " characters.");
    }
    String lower = trimmed.toLowerCase(Locale.ROOT);
    if (otherRuleNames.stream().anyMatch(other -> other.trim().toLowerCase(Locale.ROOT).equals(lower))) {
      throw badRequest("A rule named \"" + trimmed + "\" already exists.");
    }
  }

  private static void validateGroup(BreachGroup group, BreachSubject subject, DataModelConfig model) {
    if (group == null || group.combinator() == null) {
      throw badRequest("Each group needs a combinator.");
    }
    if (group.conditions().isEmpty()) {
      throw badRequest("Each group needs at least one condition.");
    }
    if (group.conditions().size() > MAX_ITEMS) {
      throw badRequest("A group holds at most " + MAX_ITEMS + " conditions.");
    }
    for (BreachCondition condition : group.conditions()) {
      validateCondition(condition, subject, model);
    }
  }

  private static void validateCondition(
      BreachCondition condition, BreachSubject subject, DataModelConfig model) {
    if (condition == null || condition.scope() == null || condition.operator() == null) {
      throw badRequest("Each condition needs a scope and an operator.");
    }
    if (!condition.scope().fits(subject)) {
      throw badRequest("Scope " + condition.scope() + " does not apply to a " + subject + " rule.");
    }
    List<DataModelField> allowed =
        condition.scope().readsFlowAttributes()
            ? model.edgeFields()
            : concat(model.nodeFields(), model.nodeRefFields());
    String attribute = condition.attribute();
    if (allowed.stream().noneMatch(field -> field.key().equals(attribute))) {
      throw badRequest(
          "Attribute \"" + attribute + "\" is not a Data Model attribute of scope " + condition.scope() + ".");
    }
    if (!condition.operator().needsValue()) {
      return;
    }
    if (condition.value().isEmpty()) {
      throw badRequest("The condition on \"" + attribute + "\" needs a value.");
    }
    if (condition.operator().isNumeric() && BreachNumber.parse(condition.value()) == null) {
      throw badRequest("The condition on \"" + attribute + "\" needs a number, got \"" + condition.value() + "\".");
    }
  }

  private static List<DataModelField> concat(List<DataModelField> first, List<DataModelField> second) {
    return Stream.concat(first.stream(), second.stream()).toList();
  }

  private static ResponseStatusException badRequest(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
