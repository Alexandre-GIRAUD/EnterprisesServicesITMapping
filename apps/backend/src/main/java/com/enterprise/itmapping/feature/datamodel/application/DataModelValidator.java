package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Component
public class DataModelValidator {

  private static final Pattern KEY_PATTERN = Pattern.compile("[a-z][a-z0-9_]{1,63}");

  /** Reserved for both EDGE and NODE (union — simpler validation). */
  private static final Set<String> RESERVED_KEYS =
      Set.of(
          "id",
          "name",
          "description",
          "year",
          "connection_kind",
          "channel",
          "direction",
          "confidence",
          "discovered_from_application_id");

  public void validatePut(List<DataModelField> fields) {
    if (fields == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fields requis.");
    }
    Set<String> seen = new HashSet<>();
    for (DataModelField field : fields) {
      String key = normalizeKey(field.key());
      if (!KEY_PATTERN.matcher(key).matches()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Cle Data Model invalide: " + field.key());
      }
      if (RESERVED_KEYS.contains(key)) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Cle Data Model reservee: " + key);
      }
      if (!seen.add(key)) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Cle Data Model en doublon: " + key);
      }
      if (!StringUtils.hasText(field.label())) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Label manquant pour la cle: " + key);
      }
      if (field.detection() == null) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "detection manquante pour la cle: " + key);
      }
      if (field.target() == null) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "target manquant pour la cle: " + key);
      }
      List<String> allowed = field.allowedValues() != null ? field.allowedValues() : List.of();
      if (field.enforceEnum() && allowed.isEmpty()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "allowedValues requis lorsque enforceEnum est actif pour: " + key);
      }
    }
  }

  public DataModelConfig normalize(List<DataModelField> fields) {
    List<DataModelField> normalized =
        fields.stream()
            .map(
                f ->
                    new DataModelField(
                        normalizeKey(f.key()),
                        f.label().trim(),
                        f.description() != null ? f.description().trim() : "",
                        f.promptHint() != null ? f.promptHint().trim() : "",
                        f.allowedValues() != null
                            ? f.allowedValues().stream()
                                .map(String::trim)
                                .filter(StringUtils::hasText)
                                .distinct()
                                .toList()
                            : List.of(),
                        f.enforceEnum(),
                        f.required(),
                        DataModelDetection.orDefault(f.detection()),
                        DataModelTarget.orDefault(f.target())))
            .toList();
    return new DataModelConfig(normalized);
  }

  private static String normalizeKey(String key) {
    return key != null ? key.trim().toLowerCase(Locale.ROOT) : "";
  }
}
