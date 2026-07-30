package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Validates and filters LLM attribute maps against the active Data Model for a given {@link
 * DataModelTarget}. Manual / wrong-target / unknown keys are stripped. {@code required} applies
 * only to automatic fields of that target.
 */
@Component
public class DataModelAttributeResolver {

  private static final Logger log = LoggerFactory.getLogger(DataModelAttributeResolver.class);

  public record ValidationResult(
      boolean accepted,
      Map<String, String> attributes,
      String skipReason,
      String skipDetail) {}

  /** NODE_REF validation: key → catalogue values (canonical). */
  public record NodeRefValidationResult(
      boolean accepted,
      Map<String, List<String>> refs,
      String skipReason,
      String skipDetail) {}

  /** Edge attributes — automatic EDGE fields only. */
  public ValidationResult validate(
      DataModelConfig config, Map<String, String> rawAttributes) {
    return validate(config, rawAttributes, DataModelTarget.EDGE);
  }

  public ValidationResult validate(
      DataModelConfig config, Map<String, String> rawAttributes, DataModelTarget target) {
    DataModelTarget effective = DataModelTarget.orDefault(target);
    if (effective == DataModelTarget.NODE_REF) {
      throw new IllegalArgumentException("Use validateNodeRefs for NODE_REF");
    }
    List<DataModelField> scope =
        effective == DataModelTarget.NODE
            ? (config != null ? config.automaticNodeFields() : List.of())
            : (config != null ? config.automaticEdgeFields() : List.of());

    if (scope.isEmpty()) {
      return new ValidationResult(true, Map.of(), null, null);
    }

    Map<String, DataModelField> byKey = new LinkedHashMap<>();
    for (DataModelField field : scope) {
      byKey.put(field.key(), field);
    }

    Map<String, String> accepted = new LinkedHashMap<>();
    Map<String, String> raw = rawAttributes != null ? rawAttributes : Map.of();

    for (Map.Entry<String, String> entry : raw.entrySet()) {
      String key = normalizeKey(entry.getKey());
      String value = entry.getValue() != null ? entry.getValue().trim() : "";
      if (!StringUtils.hasText(key) || !StringUtils.hasText(value)) {
        continue;
      }
      DataModelField field = byKey.get(key);
      if (field == null) {
        log.debug(
            "Data Model attribute stripped unknown/manual/wrong-target key={} target={}",
            key,
            effective);
        continue;
      }
      if (field.enforceEnum() && field.allowedValues() != null && !field.allowedValues().isEmpty()) {
        String matched = matchAllowed(value, field.allowedValues());
        if (matched == null) {
          String reason =
              effective == DataModelTarget.NODE
                  ? "data_model_node_valeur_invalide"
                  : "data_model_valeur_invalide";
          return new ValidationResult(false, Map.of(), reason, key + "=" + value);
        }
        accepted.put(key, matched);
      } else {
        accepted.put(key, value);
      }
    }

    for (DataModelField field : scope) {
      if (field.required() && !accepted.containsKey(field.key())) {
        String reason =
            effective == DataModelTarget.NODE
                ? "data_model_node_champ_manquant"
                : "data_model_champ_manquant";
        return new ValidationResult(false, Map.of(), reason, field.key());
      }
    }

    return new ValidationResult(true, Map.copyOf(accepted), null, null);
  }

  /**
   * Validates LLM {@code node_refs}: each key maps to a list of catalogue values. Unknown values
   * are stripped (soft) rather than failing the whole payload; required missing keys soft-fail the
   * NODE_REF write only when {@code failOnRequired}.
   */
  public NodeRefValidationResult validateNodeRefs(
      DataModelConfig config, Map<String, List<String>> rawRefs) {
    List<DataModelField> scope =
        config != null ? config.automaticNodeRefFields() : List.of();
    if (scope.isEmpty()) {
      return new NodeRefValidationResult(true, Map.of(), null, null);
    }

    Map<String, DataModelField> byKey = new LinkedHashMap<>();
    for (DataModelField field : scope) {
      byKey.put(field.key(), field);
    }

    Map<String, List<String>> accepted = new LinkedHashMap<>();
    Map<String, List<String>> raw = rawRefs != null ? rawRefs : Map.of();

    for (Map.Entry<String, List<String>> entry : raw.entrySet()) {
      String key = normalizeKey(entry.getKey());
      DataModelField field = byKey.get(key);
      if (field == null) {
        log.debug("Data Model node_refs stripped unknown/manual key={}", key);
        continue;
      }
      List<String> matched = new ArrayList<>();
      Set<String> seen = new LinkedHashSet<>();
      List<String> values = entry.getValue() != null ? entry.getValue() : List.of();
      for (String value : values) {
        if (!StringUtils.hasText(value)) {
          continue;
        }
        String canon = matchAllowed(value, field.allowedValues());
        if (canon == null) {
          log.info(
              "NODE_REF value outside catalogue skipped fieldKey={} value={}", key, value.trim());
          continue;
        }
        if (seen.add(canon.toLowerCase(Locale.ROOT))) {
          matched.add(canon);
        }
      }
      if (!field.multiple() && matched.size() > 1) {
        matched = List.of(matched.getFirst());
      }
      if (!matched.isEmpty()) {
        accepted.put(key, List.copyOf(matched));
      }
    }

    for (DataModelField field : scope) {
      if (field.required() && !accepted.containsKey(field.key())) {
        return new NodeRefValidationResult(
            false, Map.of(), "data_model_node_ref_champ_manquant", field.key());
      }
    }

    return new NodeRefValidationResult(true, Map.copyOf(accepted), null, null);
  }

  /** Keys the edge writer may persist. */
  public Set<String> allowedKeys(DataModelConfig config) {
    return allowedKeys(config, DataModelTarget.EDGE);
  }

  public Set<String> allowedKeys(DataModelConfig config, DataModelTarget target) {
    DataModelTarget effective = DataModelTarget.orDefault(target);
    List<DataModelField> scope =
        switch (effective) {
          case NODE -> config != null ? config.automaticNodeFields() : List.of();
          case NODE_REF -> config != null ? config.automaticNodeRefFields() : List.of();
          case EDGE -> config != null ? config.automaticEdgeFields() : List.of();
        };
    if (scope.isEmpty()) {
      return Set.of();
    }
    Set<String> keys = new LinkedHashSet<>();
    for (DataModelField field : scope) {
      keys.add(field.key());
    }
    return Set.copyOf(keys);
  }

  private static String matchAllowed(String value, List<String> allowedValues) {
    if (allowedValues == null) {
      return null;
    }
    for (String allowed : allowedValues) {
      if (allowed.equalsIgnoreCase(value.trim())) {
        return allowed;
      }
    }
    return null;
  }

  private static String normalizeKey(String key) {
    return key != null ? key.trim().toLowerCase(Locale.ROOT) : "";
  }
}
