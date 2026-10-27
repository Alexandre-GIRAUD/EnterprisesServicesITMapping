package com.enterprise.itmapping.feature.changedetection.application;

import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemKind;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Turns a diff deduction into review rows. Accept writes the payload; it does not scan again. */
public final class DetectedChangeDrafts {

  private DetectedChangeDrafts() {}

  public record ProposedConnection(
      String peerName, String direction, Map<String, Object> edgeAttributes) {}

  public record ProposedModule(String slug, String businessName) {}

  public record Draft(ChangeDetectionItemKind kind, String summary, Map<String, Object> payload) {}

  /**
   * When the diff names one connection, edge values read from the patch stay on that connection.
   * Several connections are left untouched: the patch does not say which one owns the value.
   */
  public static List<ProposedConnection> attachSingleEdgeHits(
      List<ProposedConnection> proposed, Map<String, String> edgeHits) {
    if (proposed == null || proposed.isEmpty()) {
      return List.of();
    }
    if (proposed.size() != 1 || edgeHits == null || edgeHits.isEmpty()) {
      return List.copyOf(proposed);
    }
    ProposedConnection only = proposed.get(0);
    Map<String, Object> merged = new LinkedHashMap<>();
    if (only.edgeAttributes() != null) {
      merged.putAll(only.edgeAttributes());
    }
    for (Map.Entry<String, String> hit : edgeHits.entrySet()) {
      if (hit.getKey() != null && !hit.getKey().isBlank() && hit.getValue() != null) {
        merged.putIfAbsent(hit.getKey(), hit.getValue());
      }
    }
    return List.of(new ProposedConnection(only.peerName(), only.direction(), Map.copyOf(merged)));
  }

  public static List<Draft> connections(List<ProposedConnection> proposed) {
    if (proposed == null || proposed.isEmpty()) {
      return List.of();
    }
    List<Draft> drafts = new ArrayList<>();
    for (ProposedConnection connection : proposed) {
      if (connection.peerName() == null || connection.peerName().isBlank()) {
        continue;
      }
      String direction = connection.direction() == null ? "" : connection.direction().trim();
      if (!"outbound".equalsIgnoreCase(direction) && !"inbound".equalsIgnoreCase(direction)) {
        continue;
      }
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("action", "APPLY_CONNECTION");
      payload.put("peerApplicationName", connection.peerName().trim());
      payload.put("direction", direction.toLowerCase());
      payload.put(
          "edgeAttributes",
          connection.edgeAttributes() == null ? Map.of() : Map.copyOf(connection.edgeAttributes()));
      drafts.add(
          new Draft(ChangeDetectionItemKind.CONNECTION, connectionSummary(connection), payload));
    }
    return List.copyOf(drafts);
  }

  public static List<ProposedModule> withoutExistingModules(
      List<ProposedModule> proposed, Collection<String> existingNames) {
    if (proposed == null || proposed.isEmpty()) {
      return List.of();
    }
    Set<String> existing = new HashSet<>();
    if (existingNames != null) {
      for (String name : existingNames) {
        if (name != null && !name.isBlank()) {
          existing.add(moduleNameKey(name));
        }
      }
    }
    List<ProposedModule> fresh = new ArrayList<>();
    for (ProposedModule module : proposed) {
      if (module.businessName() == null || module.businessName().isBlank()) {
        continue;
      }
      if (existing.contains(moduleNameKey(module.businessName()))) {
        continue;
      }
      fresh.add(module);
    }
    return List.copyOf(fresh);
  }

  private static String moduleNameKey(String name) {
    return name.trim().toLowerCase(Locale.ROOT);
  }

  public static List<Draft> modules(List<ProposedModule> proposed) {
    if (proposed == null || proposed.isEmpty()) {
      return List.of();
    }
    List<Draft> drafts = new ArrayList<>();
    for (ProposedModule module : proposed) {
      if (module.slug() == null
          || module.slug().isBlank()
          || module.businessName() == null
          || module.businessName().isBlank()) {
        continue;
      }
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("action", "APPLY_MODULE");
      payload.put("slug", module.slug().trim());
      payload.put("businessName", module.businessName().trim());
      drafts.add(
          new Draft(
              ChangeDetectionItemKind.MODULE,
              "New module " + module.businessName().trim(),
              payload));
    }
    return List.copyOf(drafts);
  }

  private static String connectionSummary(ProposedConnection connection) {
    String sense =
        "inbound".equalsIgnoreCase(connection.direction()) ? "Inbound" : "Outbound";
    String attributes = attributeText(connection.edgeAttributes());
    String base = sense + " connection to " + connection.peerName().trim();
    return attributes.isEmpty() ? base : base + ": " + attributes;
  }

  private static String attributeText(Map<String, Object> attributes) {
    if (attributes == null || attributes.isEmpty()) {
      return "";
    }
    return attributes.entrySet().stream()
        .filter(entry -> entry.getKey() != null && !entry.getKey().isBlank() && entry.getValue() != null)
        .sorted(Map.Entry.comparingByKey())
        .map(entry -> entry.getKey().trim() + "=" + String.valueOf(entry.getValue()).trim())
        .collect(Collectors.joining(", "));
  }
}
