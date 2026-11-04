package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.breach.domain.BreachCondition;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachGroup;
import com.enterprise.itmapping.feature.breach.domain.BreachNumber;
import com.enterprise.itmapping.feature.breach.domain.BreachRule;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachRuleRequest;
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

  /** Caps both the groups of a rule and the conditions of a group, so a rule stays readable. */
  static final int MAX_GROUPS_OR_CONDITIONS = 20;

  /**
   * @param otherRuleNames names of the other rules (the edited rule excluded), compared ignoring case
   */
  public void validate(BreachRuleRequest request, DataModelConfig model, Set<String> otherRuleNames) {
    validateName(request.name(), otherRuleNames);
    if (request.subject() == null) {
      throw reject("A rule needs a subject (APPLICATION or FLOW).");
    }
    BreachDefinition definition = request.definition();
    if (definition == null || definition.combinator() == null) {
      throw reject("A rule needs a combinator between its groups.");
    }
    List<BreachGroup> groups = definition.groups();
    if (groups.isEmpty()) {
      throw reject("A rule needs at least one group.");
    }
    if (groups.size() > MAX_GROUPS_OR_CONDITIONS) {
      throw reject("A rule holds at most " + MAX_GROUPS_OR_CONDITIONS + " groups.");
    }
    groups.forEach(group -> validateGroup(group, request.subject(), model));
  }

  private static void validateName(String name, Set<String> otherRuleNames) {
    if (!StringUtils.hasText(name)) {
      throw reject("A rule needs a name.");
    }
    String trimmed = name.trim();
    if (trimmed.length() > BreachRule.MAX_NAME_LENGTH) {
      throw reject("A rule name holds at most " + BreachRule.MAX_NAME_LENGTH + " characters.");
    }
    String lower = trimmed.toLowerCase(Locale.ROOT);
    if (otherRuleNames.stream().anyMatch(other -> other.trim().toLowerCase(Locale.ROOT).equals(lower))) {
      throw reject("A rule named \"" + trimmed + "\" already exists.");
    }
  }

  private static void validateGroup(BreachGroup group, BreachSubject subject, DataModelConfig model) {
    if (group == null || group.combinator() == null) {
      throw reject("Each group needs a combinator.");
    }
    if (group.conditions().isEmpty()) {
      throw reject("Each group needs at least one condition.");
    }
    if (group.conditions().size() > MAX_GROUPS_OR_CONDITIONS) {
      throw reject("A group holds at most " + MAX_GROUPS_OR_CONDITIONS + " conditions.");
    }
    group.conditions().forEach(condition -> validateCondition(condition, subject, model));
  }

  private static void validateCondition(BreachCondition condition, BreachSubject subject, DataModelConfig model) {
    if (condition == null || condition.scope() == null || condition.operator() == null) {
      throw reject("Each condition needs a scope and an operator.");
    }
    if (!condition.scope().isAllowedFor(subject)) {
      throw reject("Scope " + condition.scope() + " does not apply to a " + subject + " rule.");
    }
    validateAttribute(condition, model);
    validateValue(condition);
  }

  private static void validateAttribute(BreachCondition condition, DataModelConfig model) {
    List<DataModelField> allowed =
        condition.scope().isFlowScope()
            ? model.edgeFields()
            : Stream.concat(model.nodeFields().stream(), model.nodeRefFields().stream()).toList();
    if (allowed.stream().noneMatch(field -> field.key().equals(condition.attribute()))) {
      throw reject(
          "Attribute \"" + condition.attribute() + "\" is not a Data Model attribute of scope "
              + condition.scope() + ".");
    }
  }

  private static void validateValue(BreachCondition condition) {
    if (!condition.operator().isValueRequired()) {
      return;
    }
    String subject = "The condition on \"" + condition.attribute() + "\"";
    if (condition.value().isEmpty()) {
      throw reject(subject + " needs a value.");
    }
    if (condition.operator().isNumeric() && BreachNumber.parse(condition.value()) == null) {
      throw reject(subject + " needs a number, got \"" + condition.value() + "\".");
    }
  }

  private static ResponseStatusException reject(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
