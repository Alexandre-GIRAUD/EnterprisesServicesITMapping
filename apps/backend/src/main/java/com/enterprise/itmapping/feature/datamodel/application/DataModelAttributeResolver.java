package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
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

/** Validates and filters {@code edge_attributes} from the LLM against the active Data Model. */
@Component
public class DataModelAttributeResolver {

  private static final Logger log = LoggerFactory.getLogger(DataModelAttributeResolver.class);

  public record ValidationResult(
      boolean accepted,
      Map<String, String> attributes,
      String skipReason,
      String skipDetail) {}

  /**
   * When config is empty, returns rejected with empty attributes (defense in depth — caller should
   * not invoke when config is empty).
   */
  public ValidationResult validate(
      DataModelConfig config, Map<String, String> rawAttributes) {
    if (config == null || config.isEmpty()) {
      return new ValidationResult(true, Map.of(), null, null);
    }

    Map<String, DataModelField> fieldByKey = new LinkedHashMap<>();
    for (DataModelField field : config.fields()) {
      fieldByKey.put(field.key(), field);
    }

    Map<String, String> accepted = new LinkedHashMap<>();
    Map<String, String> raw = rawAttributes != null ? rawAttributes : Map.of();

    for (Map.Entry<String, String> entry : raw.entrySet()) {
      String key = normalizeKey(entry.getKey());
      String value = entry.getValue() != null ? entry.getValue().trim() : "";
      if (!StringUtils.hasText(key) || !StringUtils.hasText(value)) {
        continue;
      }
      DataModelField field = fieldByKey.get(key);
      if (field == null) {
        log.debug("Data Model attribute stripped unknown key={}", key);
        continue;
      }
      if (field.enforceEnum() && field.allowedValues() != null && !field.allowedValues().isEmpty()) {
        String matched = matchAllowed(value, field.allowedValues());
        if (matched == null) {
          return new ValidationResult(
              false,
              Map.of(),
              "data_model_valeur_invalide",
              key + "=" + value);
        }
        accepted.put(key, matched);
      } else {
        accepted.put(key, value);
      }
    }

    for (DataModelField field : config.fields()) {
      if (field.required() && !accepted.containsKey(field.key())) {
        return new ValidationResult(
            false, Map.of(), "data_model_champ_manquant", field.key());
      }
    }

    return new ValidationResult(true, Map.copyOf(accepted), null, null);
  }

  public Set<String> allowedKeys(DataModelConfig config) {
    if (config == null || config.isEmpty()) {
      return Set.of();
    }
    Set<String> keys = new LinkedHashSet<>();
    for (DataModelField field : config.fields()) {
      keys.add(field.key());
    }
    return Set.copyOf(keys);
  }

  private static String matchAllowed(String value, List<String> allowedValues) {
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
