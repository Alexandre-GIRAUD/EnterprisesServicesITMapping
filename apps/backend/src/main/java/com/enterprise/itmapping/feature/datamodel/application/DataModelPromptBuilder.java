package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Builds the dynamic "## Active Data Model" section injected into the connection-discovery user
 * prompt. Returns an empty string when there are no {@code AUTOMATIC_DETECTION} fields — callers
 * must not inject the section in that case. Manual fields are never listed.
 */
@Component
public class DataModelPromptBuilder {

  public String buildPromptSection(DataModelConfig config) {
    if (config == null || !config.hasAutomaticFields()) {
      return "";
    }
    List<DataModelField> automatic = config.automaticFields();
    StringBuilder sb = new StringBuilder();
    sb.append("## Active Data Model (edge enrichment)\n\n");
    sb.append(
        "For EACH connection, populate \"edge_attributes\" using ONLY the field keys listed"
            + " below.\n\n");

    for (DataModelField field : automatic) {
      sb.append("Field key: ").append(field.key()).append('\n');
      sb.append("  Label: ").append(field.label()).append('\n');
      if (StringUtils.hasText(field.description())) {
        sb.append("  Meaning: ").append(field.description().trim()).append('\n');
      }
      if (StringUtils.hasText(field.promptHint())) {
        sb.append("  Detection hint: ").append(field.promptHint().trim()).append('\n');
      }
      if (field.allowedValues() != null && !field.allowedValues().isEmpty()) {
        sb.append("  Allowed values (pick exactly one): ");
        sb.append(String.join(" | ", field.allowedValues())).append('\n');
        if (field.enforceEnum()) {
          sb.append(
              "  STRICT: value MUST be one of the allowed values, or omit the key.\n");
        }
      } else {
        sb.append("  Free text: short normalized value from code evidence only.\n");
      }
      if (field.required()) {
        sb.append(
            "  REQUIRED: do not emit this connection if this field cannot be inferred.\n");
      }
      sb.append('\n');
    }

    sb.append(
        """
        Rules:
        - Use ONLY keys listed in Active Data Model (no extra keys).
        - Omit a key if no reliable evidence in the repository.
        - Never invent values outside allowed lists when STRICT applies.
        - edge_attributes = what transits on the flow; connection_kind = how (API, KAFKA, ...).
        - Search the codebase using field labels, detection hints, and allowed value literals when grepping.
        - Fields not listed here are out of scope for AI detection (manual / not requested).
        """);
    return sb.toString().trim();
  }
}
