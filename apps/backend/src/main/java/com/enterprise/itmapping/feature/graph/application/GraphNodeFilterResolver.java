package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Resolves raw graph filters against the active Data Model for {@code NODE} (flat props) and {@code
 * NODE_REF} (catalogue ids) keys.
 */
@Component
public class GraphNodeFilterResolver {

  private static final Pattern KEY_PATTERN = Pattern.compile("[a-z][a-z0-9_]{1,63}");

  public record Resolved(
      Map<String, List<String>> nodeAttributes,
      Map<String, List<String>> nodeRefs,
      List<String> rejectedKeys) {

    public Resolved {
      nodeAttributes = nodeAttributes != null ? Map.copyOf(nodeAttributes) : Map.of();
      nodeRefs = nodeRefs != null ? Map.copyOf(nodeRefs) : Map.of();
      rejectedKeys = rejectedKeys != null ? List.copyOf(rejectedKeys) : List.of();
    }

    /** Backward-compatible alias used by existing call sites. */
    public Map<String, List<String>> filters() {
      return nodeAttributes;
    }

    public boolean isEmpty() {
      return nodeAttributes.isEmpty() && nodeRefs.isEmpty();
    }
  }

  public Resolved resolve(DataModelConfig config, Map<String, List<String>> rawNodeAttributes) {
    return resolve(config, rawNodeAttributes, Map.of());
  }

  public Resolved resolve(
      DataModelConfig config,
      Map<String, List<String>> rawNodeAttributes,
      Map<String, List<String>> rawNodeRefs) {
    Set<String> nodeKeys = keys(config != null ? config.nodeFields() : List.of());
    Set<String> nodeRefKeys = keys(config != null ? config.nodeRefFields() : List.of());

    List<String> rejected = new ArrayList<>();
    Map<String, List<String>> nodeAccepted =
        accept(rawNodeAttributes, nodeKeys, rejected);
    Map<String, List<String>> refAccepted = accept(rawNodeRefs, nodeRefKeys, rejected);

    return new Resolved(nodeAccepted, refAccepted, rejected);
  }

  private static Map<String, List<String>> accept(
      Map<String, List<String>> raw, Set<String> allowedKeys, List<String> rejected) {
    if (raw == null || raw.isEmpty()) {
      return Map.of();
    }
    Map<String, List<String>> accepted = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> entry : raw.entrySet()) {
      String key = normalizeKey(entry.getKey());
      if (!KEY_PATTERN.matcher(key).matches() || !allowedKeys.contains(key)) {
        if (StringUtils.hasText(key)) {
          rejected.add(key);
        }
        continue;
      }
      List<String> values = normalizeValues(entry.getValue());
      if (!values.isEmpty()) {
        accepted.put(key, values);
      }
    }
    return accepted;
  }

  private static Set<String> keys(List<DataModelField> fields) {
    return fields.stream().map(DataModelField::key).collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private static List<String> normalizeValues(List<String> raw) {
    if (raw == null || raw.isEmpty()) {
      return List.of();
    }
    Set<String> values = new LinkedHashSet<>();
    for (String value : raw) {
      if (StringUtils.hasText(value)) {
        values.add(value.trim());
      }
    }
    return List.copyOf(values);
  }

  private static String normalizeKey(String key) {
    return key != null ? key.trim().toLowerCase(Locale.ROOT) : "";
  }
}
