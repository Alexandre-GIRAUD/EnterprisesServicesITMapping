package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Builds the dynamic Active Data Model section(s) for the connection-discovery user prompt.
 * Returns empty when there are no automatic EDGE, NODE or NODE_REF fields. Manual fields are never
 * listed.
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
    List<DataModelField> nodeRefFields = config.automaticNodeRefFields();

    if (!edgeFields.isEmpty()) {
      appendEdgeSection(sb, edgeFields);
    }
    if (!nodeFields.isEmpty()) {
      if (!sb.isEmpty()) {
        sb.append("\n\n");
      }
      appendNodeSection(sb, nodeFields);
    }
    if (!nodeRefFields.isEmpty()) {
      if (!sb.isEmpty()) {
        sb.append("\n\n");
      }
      appendNodeRefSection(sb, nodeRefFields);
    }
    return sb.toString().trim();
  }

  private static void appendEdgeSection(StringBuilder sb, List<DataModelField> fields) {
    sb.append("## Active Data Model (edge enrichment)\n\n");
    sb.append(
        "For EACH connection, populate \"edge_attributes\" using ONLY the field keys listed"
            + " below.\n\n");
    appendFields(sb, fields, false);
    sb.append(
        """
        Rules:
        - Use ONLY keys listed in this edge section (no extra keys).
        - Omit a key if no reliable evidence in the repository.
        - Never invent values outside allowed lists when STRICT applies.
        - edge_attributes = what transits on the flow; connection_kind = how (API, KAFKA, ...).
        - Do not put application-node or node-ref fields into edge_attributes.
        - Search the codebase using field labels, detection hints, and allowed value literals when grepping.
        - Fields not listed here are out of scope for AI edge detection (manual / node / not requested).
        """);
  }

  private static void appendNodeSection(StringBuilder sb, List<DataModelField> fields) {
    sb.append("## Active Data Model (application node enrichment)\n\n");
    sb.append(
        "For the ANALYZED application only, populate root-level \"node_attributes\" using ONLY"
            + " the field keys listed below.\n\n");
    appendFields(sb, fields, false);
    sb.append(
        """
        Rules:
        - Use ONLY keys listed in this application-node section (no extra keys).
        - Omit a key if no reliable evidence in the repository.
        - Never invent values outside allowed lists when STRICT applies.
        - node_attributes describe the analyzed Application itself (not peers, not connection flows).
        - Do not put node fields into edge_attributes, node_refs, or vice versa.
        - Search the codebase using field labels, detection hints, and allowed value literals when grepping.
        - Fields not listed here are out of scope for AI node detection (manual / edge / not requested).
        """);
  }

  private static void appendNodeRefSection(StringBuilder sb, List<DataModelField> fields) {
    sb.append("## Active Data Model (application classification / NODE_REF)\n\n");
    sb.append(
        "For the ANALYZED application only, populate root-level \"node_refs\" using ONLY the"
            + " field keys listed below. Each value MUST be picked from the closed catalogue of"
            + " that field. Do NOT invent catalogue entries.\n\n");
    appendFields(sb, fields, true);
    sb.append(
        """
        Rules:
        - Use ONLY keys listed in this NODE_REF section.
        - Values are a JSON array of catalogue strings per key, e.g. "node_refs": { "tier_ref": ["GOLD"] }.
        - If the field is single-value, return at most one catalogue entry in the array.
        - If the field allows multiple, return zero or more catalogue entries.
        - Omit a key (or use []) when there is no reliable evidence.
        - Never invent values outside the Allowed values list.
        - Do not put NODE_REF values into node_attributes or edge_attributes.
        """);
  }

  private static void appendFields(
      StringBuilder sb, List<DataModelField> fields, boolean nodeRef) {
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
        if (nodeRef) {
          sb.append("  Allowed values (closed catalogue");
          if (field.multiple()) {
            sb.append(", multiple allowed");
          } else {
            sb.append(", pick at most one");
          }
          sb.append("): ");
        } else {
          sb.append("  Allowed values (pick exactly one): ");
        }
        sb.append(String.join(" | ", field.allowedValues())).append('\n');
        if (field.enforceEnum() || nodeRef) {
          sb.append("  STRICT: value MUST be one of the allowed values, or omit the key.\n");
        }
      } else if (!nodeRef) {
        sb.append("  Free text: short normalized value from code evidence only.\n");
      }
      if (field.required()) {
        if (field.isNodeRefTarget()) {
          sb.append(
              "  REQUIRED: node_refs should include this field when evidence exists; omit only"
                  + " if no evidence at all.\n");
        } else if (field.isNodeTarget()) {
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
