package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Builds the dynamic Active Data Model section(s) for the connection-discovery user prompt.
 * Returns empty when there are no automatic EDGE and no automatic NODE fields. Manual fields are
 * never listed.
 */
@Component
public class DataModelPromptBuilder {

  public String buildPromptSection(DataModelConfig config) {
    if (config == null || !config.hasAutomaticFields()) {
      return "";
    }
    StringBuilder sb = new StringBuilder();
    List<DataModelField> edgeFields = config.automaticEdgeFields();
    List<DataModelField> nodeFields = config.automaticNodeFields();

    if (!edgeFields.isEmpty()) {
      appendEdgeSection(sb, edgeFields);
    }
    if (!nodeFields.isEmpty()) {
      if (!sb.isEmpty()) {
        sb.append("\n\n");
      }
      appendNodeSection(sb, nodeFields);
    }
    return sb.toString().trim();
  }

  private static void appendEdgeSection(StringBuilder sb, List<DataModelField> fields) {
    sb.append("## Active Data Model (edge enrichment)\n\n");
    sb.append(
        "For EACH connection, populate \"edge_attributes\" using ONLY the field keys listed"
            + " below.\n\n");
    appendFields(sb, fields);
    sb.append(
        """
        Rules:
        - Use ONLY keys listed in this edge section (no extra keys).
        - Omit a key if no reliable evidence in the repository.
        - Never invent values outside allowed lists when STRICT applies.
        - edge_attributes = what transits on the flow; connection_kind = how (API, KAFKA, ...).
        - Do not put application-node fields into edge_attributes.
        - Search the codebase using field labels, detection hints, and allowed value literals when grepping.
        - Fields not listed here are out of scope for AI edge detection (manual / node / not requested).
        """);
  }

  private static void appendNodeSection(StringBuilder sb, List<DataModelField> fields) {
    sb.append("## Active Data Model (application node enrichment)\n\n");
    sb.append(
        "For the ANALYZED application only, populate root-level \"node_attributes\" using ONLY"
            + " the field keys listed below.\n\n");
    appendFields(sb, fields);
    sb.append(
        """
        Rules:
        - Use ONLY keys listed in this application-node section (no extra keys).
        - Omit a key if no reliable evidence in the repository.
        - Never invent values outside allowed lists when STRICT applies.
        - node_attributes describe the analyzed Application itself (not peers, not connection flows).
        - Do not put node fields into edge_attributes or vice versa.
        - Search the codebase using field labels, detection hints, and allowed value literals when grepping.
        - Fields not listed here are out of scope for AI node detection (manual / edge / not requested).
        """);
  }

  private static void appendFields(StringBuilder sb, List<DataModelField> fields) {
    for (DataModelField field : fields) {
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
          sb.append("  STRICT: value MUST be one of the allowed values, or omit the key.\n");
        }
      } else {
        sb.append("  Free text: short normalized value from code evidence only.\n");
      }
      if (field.required()) {
        if (field.isNodeTarget()) {
          sb.append(
              "  REQUIRED: node_attributes must include this field if the application is"
                  + " enriched; omit node enrichment entirely only if no evidence at all.\n");
        } else {
          sb.append(
              "  REQUIRED: do not emit this connection if this field cannot be inferred.\n");
        }
      }
      sb.append('\n');
    }
  }
}
