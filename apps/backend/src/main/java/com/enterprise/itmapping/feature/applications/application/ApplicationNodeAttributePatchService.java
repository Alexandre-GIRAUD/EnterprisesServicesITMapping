package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Manual edition of the Data Model {@code target=NODE} attributes of an Application (drawer form).
 *
 * <p>Only keys declared as Data Model NODE fields are accepted; anything else (unknown key, EDGE
 * field, reserved identity key) is silently ignored so a stale form never corrupts the node. A blank
 * value clears the property. When a field declares {@code enforceEnum} the value must match one of
 * its allowed values, case-insensitively.
 */
@Service
public class ApplicationNodeAttributePatchService {

  private static final Logger log =
      LoggerFactory.getLogger(ApplicationNodeAttributePatchService.class);

  private final DataModelService dataModelService;
  private final ApplicationNodeAttributeWriter writer;

  public ApplicationNodeAttributePatchService(
      DataModelService dataModelService, ApplicationNodeAttributeWriter writer) {
    this.dataModelService = dataModelService;
    this.writer = writer;
  }

  @Transactional
  public void patch(String applicationId, Map<String, String> rawAttributes) {
    List<DataModelField> nodeFields = dataModelService.loadConfig().nodeFields();
    if (nodeFields.isEmpty() || rawAttributes == null || rawAttributes.isEmpty()) {
      return;
    }

    Map<String, DataModelField> byKey = new LinkedHashMap<>();
    for (DataModelField field : nodeFields) {
      byKey.put(field.key(), field);
    }

    Map<String, String> toSet = new LinkedHashMap<>();
    Set<String> toRemove = new LinkedHashSet<>();

    for (Map.Entry<String, String> entry : rawAttributes.entrySet()) {
      String key = normalizeKey(entry.getKey());
      DataModelField field = byKey.get(key);
      if (field == null) {
        log.debug("Node attribute patch ignored key={} (not a Data Model NODE field)", key);
        continue;
      }
      String value = entry.getValue() != null ? entry.getValue().trim() : "";
      if (!StringUtils.hasText(value)) {
        toRemove.add(key);
        continue;
      }
      toSet.put(key, requireAllowedValue(field, value));
    }

    writer.write(applicationId, toSet, byKey.keySet());
    writer.remove(applicationId, toRemove);
  }

  private static String requireAllowedValue(DataModelField field, String value) {
    if (!field.enforceEnum() || field.allowedValues().isEmpty()) {
      return value;
    }
    for (String allowed : field.allowedValues()) {
      if (allowed.equalsIgnoreCase(value)) {
        return allowed;
      }
    }
    throw new ResponseStatusException(
        HttpStatus.BAD_REQUEST,
        "Valeur non autorisee pour " + field.key() + ": " + value);
  }

  private static String normalizeKey(String key) {
    return key != null ? key.trim().toLowerCase(Locale.ROOT) : "";
  }
}
