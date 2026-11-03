package com.enterprise.itmapping.feature.referential.application;

import com.enterprise.itmapping.feature.datamodel.application.AttributeValues;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.referential.domain.ReferentialSyncStatus;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Reads one mapped attribute out of a referential JSON object. */
final class ReferentialPayload {

  static final int MAX_BODY_CHARS = 100_000;

  private static final Pattern SEGMENT = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

  private ReferentialPayload() {}

  static boolean isPath(String path) {
    if (path == null || path.isBlank() || path.length() > 200) {
      return false;
    }
    for (String part : path.split("\\.", -1)) {
      if (!SEGMENT.matcher(part).matches()) {
        return false;
      }
    }
    return true;
  }

  static JsonNode parseObject(String body, ObjectMapper mapper) {
    if (body == null || body.isBlank()) {
      throw tooLargeOrInvalid("Referential response was empty.");
    }
    // ponytail: hard cap, raise MAX_BODY_CHARS if a referential payload needs more than 100k.
    if (body.length() > MAX_BODY_CHARS) {
      throw tooLargeOrInvalid("Referential response is too large.");
    }
    try {
      JsonNode tree = mapper.readTree(body);
      if (tree == null || !tree.isObject()) {
        throw tooLargeOrInvalid("Referential response must be a JSON object.");
      }
      return tree;
    } catch (JsonProcessingException ex) {
      throw tooLargeOrInvalid("Referential response must be a JSON object.");
    }
  }

  static boolean isArray(JsonNode root, String path) {
    JsonNode node = dig(root, path);
    return node != null && node.isArray();
  }

  static Outcome readField(JsonNode root, String path, DataModelField field) {
    JsonNode node = dig(root, path);
    if (node == null || node.isMissingNode()) {
      return Outcome.terminal(ReferentialSyncStatus.MISSING);
    }
    if (node.isObject()) {
      return Outcome.terminal(ReferentialSyncStatus.INVALID);
    }
    Object raw = rawValue(node, field);
    if (raw == null) {
      return Outcome.terminal(ReferentialSyncStatus.INVALID);
    }
    if (rejectsAllowedValues(field, raw)) {
      return Outcome.terminal(ReferentialSyncStatus.INVALID);
    }
    AttributeValues.Parsed parsed = AttributeValues.parse(field, raw);
    if (parsed.rejectedLiteral() != null) {
      return Outcome.terminal(ReferentialSyncStatus.INVALID);
    }
    String display = AttributeValues.display(parsed.values());
    Object stored = parsed.values().isEmpty() ? "" : AttributeValues.stored(field.multiple(), parsed.values());
    return Outcome.ready(stored, display);
  }

  private static Object rawValue(JsonNode node, DataModelField field) {
    if (node.isNull() || (node.isTextual() && node.asText().isBlank())) {
      return "";
    }
    if (!node.isArray()) {
      return node.asText();
    }
    if (!field.multiple()) {
      return null;
    }
    List<String> values = new ArrayList<>();
    for (JsonNode item : node) {
      if (item == null || item.isObject() || item.isArray()) {
        return null;
      }
      if (!item.isNull()) {
        values.add(item.asText());
      }
    }
    return values;
  }

  private static boolean rejectsAllowedValues(DataModelField field, Object raw) {
    if (!field.enforceEnum() || field.allowedValues() == null || field.allowedValues().isEmpty()) {
      return false;
    }
    for (String value : AttributeValues.coerce(raw)) {
      if (AttributeValues.matchAllowed(value, field.allowedValues()) == null) {
        return true;
      }
    }
    return false;
  }

  private static JsonNode dig(JsonNode root, String path) {
    JsonNode current = root;
    for (String part : path.split("\\.", -1)) {
      if (current == null || !current.isObject() || !current.has(part)) {
        return null;
      }
      current = current.get(part);
    }
    return current;
  }

  private static ResponseStatusException tooLargeOrInvalid(String message) {
    return new ResponseStatusException(HttpStatus.BAD_GATEWAY, message);
  }

  record Outcome(ReferentialSyncStatus terminal, Object raw, String display) {
    static Outcome terminal(ReferentialSyncStatus status) {
      return new Outcome(status, null, null);
    }

    static Outcome ready(Object raw, String display) {
      return new Outcome(null, raw, display);
    }
  }
}
