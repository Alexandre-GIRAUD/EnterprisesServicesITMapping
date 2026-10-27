package com.enterprise.itmapping.feature.chat.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ApplicationNameMatch;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatMapFilters;
import com.enterprise.itmapping.feature.graph.application.GraphNodeFilterFacetService;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto.GraphFilterOptionDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.util.StringUtils;

/** Resolves one Production map filter set for the mapping chat. Does not write the graph. */
final class MappingChatFilters {

  private final ApplicationCatalogQuery catalogQuery;
  private final GraphNodeFilterFacetService filterFacets;
  private final ObjectMapper objectMapper;

  MappingChatFilters(
      GraphNodeFilterFacetService filterFacets,
      ApplicationCatalogQuery catalogQuery,
      ObjectMapper objectMapper) {
    this.filterFacets = filterFacets;
    this.catalogQuery = catalogQuery;
    this.objectMapper = objectMapper;
  }

  String listJson() {
    return toJson(listedDimensions());
  }

  Result apply(String filtersJson) {
    ChatMapFilters requested = readFilters(filtersJson);
    if (requested == null) {
      return new Result(refuse("invalid_json", null), null);
    }
    FilterDecision decision = resolveFilters(requested);
    if (!decision.accepted()) {
      return new Result(refuse(decision.error(), decision.detail()), null);
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("accepted", true);
    out.put("applied", decision.summary());
    out.put("ignored", decision.ignored());
    return new Result(toJson(out), decision.filters());
  }

  record Result(String json, ChatMapFilters filters) {}

  private ChatMapFilters readFilters(String filtersJson) {
    if (!StringUtils.hasText(filtersJson)) {
      return null;
    }
    try {
      return objectMapper.readValue(filtersJson, ChatMapFilters.class);
    } catch (JsonProcessingException ex) {
      return null;
    }
  }

  private FilterDecision resolveFilters(ChatMapFilters requested) {
    List<GraphNodeFilterDto> dimensions = listedDimensions();
    List<String> applicationIds = new ArrayList<>();
    String unresolved = resolveApplicationIds(requested.applicationIds(), applicationIds);
    if (unresolved != null) {
      return FilterDecision.refuse("application_not_resolved", unresolved);
    }
    AxisCollector collector = new AxisCollector();
    String nodeError = fillAxis(requested.nodeAttributes(), "NODE", dimensions, collector);
    if (nodeError != null) {
      return FilterDecision.refuse(nodeError, collector.detail);
    }
    String refError = fillAxis(requested.nodeRefs(), "NODE_REF", dimensions, collector);
    if (refError != null) {
      return FilterDecision.refuse(refError, collector.detail);
    }
    String edgeError = fillAxis(requested.edgeAttributes(), "EDGE", dimensions, collector);
    if (edgeError != null) {
      return FilterDecision.refuse(edgeError, collector.detail);
    }
    if (!applicationIds.isEmpty()) {
      collector.summary.add(0, axisSummary("applicationIds", "Applications", applicationIds));
    }
    ChatMapFilters filters =
        new ChatMapFilters(
            applicationIds, collector.nodeAttributes, collector.nodeRefs, collector.edgeAttributes);
    return FilterDecision.accept(filters, collector.ignored, collector.summary);
  }

  private String resolveApplicationIds(List<String> rawIds, List<String> accepted) {
    if (rawIds == null || rawIds.isEmpty()) {
      return null;
    }
    List<CatalogRow> catalogue = catalogQuery.loadAllNamed();
    for (String raw : rawIds) {
      if (!StringUtils.hasText(raw)) {
        continue;
      }
      CatalogRow match = ApplicationNameMatch.uniqueClosest(raw.trim(), catalogue);
      if (match == null) {
        return raw.trim();
      }
      if (!accepted.contains(match.id())) {
        accepted.add(match.id());
      }
    }
    return null;
  }

  private String fillAxis(
      Map<String, List<String>> requested,
      String kind,
      List<GraphNodeFilterDto> dimensions,
      AxisCollector collector) {
    if (requested == null || requested.isEmpty()) {
      return null;
    }
    for (Map.Entry<String, List<String>> entry : requested.entrySet()) {
      DimensionMatch match = matchDimension(dimensions, entry.getKey(), kind);
      if (match.dimension() == null) {
        collector.detail = entry.getKey();
        return match.error();
      }
      String error = keepValues(match.dimension(), entry.getValue(), collector);
      if (error != null) {
        return error;
      }
    }
    return null;
  }

  private String keepValues(
      GraphNodeFilterDto dimension, List<String> rawValues, AxisCollector collector) {
    if (rawValues == null || rawValues.isEmpty()) {
      return null;
    }
    List<String> kept = new ArrayList<>();
    int requestedCount = 0;
    for (String raw : rawValues) {
      if (!StringUtils.hasText(raw)) {
        continue;
      }
      requestedCount++;
      ResolvedValue resolved = resolveValue(dimension, raw.trim());
      if (resolved.ambiguous()) {
        collector.detail = raw.trim();
        return "ambiguous_value";
      }
      if (resolved.value() == null) {
        collector.ignored.add(Map.of("key", dimension.key(), "value", raw.trim()));
        continue;
      }
      if (!containsIgnoreCase(kept, resolved.value())) {
        kept.add(resolved.value());
      }
    }
    if (requestedCount > 0 && kept.isEmpty()) {
      collector.detail = dimension.key();
      return "no_valid_value";
    }
    if (!kept.isEmpty()) {
      collector.target(dimension.kind()).put(dimension.key(), List.copyOf(kept));
      collector.summary.add(axisSummary(dimension.key(), dimension.label(), kept));
    }
    return null;
  }

  private DimensionMatch matchDimension(
      List<GraphNodeFilterDto> dimensions, String keyOrLabel, String kind) {
    if (!StringUtils.hasText(keyOrLabel)) {
      return new DimensionMatch(null, "unknown_key");
    }
    String needle = keyOrLabel.trim();
    List<GraphNodeFilterDto> byKey = new ArrayList<>();
    List<GraphNodeFilterDto> byLabel = new ArrayList<>();
    for (GraphNodeFilterDto dimension : dimensions) {
      if (!kind.equals(dimension.kind())) {
        continue;
      }
      if (equalsIgnoreCase(dimension.key(), needle)) {
        byKey.add(dimension);
      } else if (equalsIgnoreCase(dimension.label(), needle)) {
        byLabel.add(dimension);
      }
    }
    if (byKey.size() == 1) {
      return new DimensionMatch(byKey.get(0), null);
    }
    if (byKey.size() > 1 || byLabel.size() > 1) {
      return new DimensionMatch(null, "ambiguous_key");
    }
    if (byLabel.size() == 1) {
      return new DimensionMatch(byLabel.get(0), null);
    }
    return new DimensionMatch(null, "unknown_key");
  }

  private ResolvedValue resolveValue(GraphNodeFilterDto dimension, String raw) {
    if ("NODE_REF".equals(dimension.kind())) {
      return resolveRef(dimension, raw);
    }
    for (String known : dimension.values()) {
      if (known != null && known.equalsIgnoreCase(raw)) {
        return new ResolvedValue(known, false);
      }
    }
    return new ResolvedValue(null, false);
  }

  private ResolvedValue resolveRef(GraphNodeFilterDto dimension, String raw) {
    for (GraphFilterOptionDto option : dimension.options()) {
      if (option.id() != null && option.id().equalsIgnoreCase(raw)) {
        return new ResolvedValue(option.id(), false);
      }
    }
    String matchedId = null;
    for (GraphFilterOptionDto option : dimension.options()) {
      if (option.name() == null || !option.name().equalsIgnoreCase(raw)) {
        continue;
      }
      if (matchedId != null && !matchedId.equals(option.id())) {
        return new ResolvedValue(null, true);
      }
      matchedId = option.id();
    }
    if (matchedId != null) {
      return new ResolvedValue(matchedId, false);
    }
    for (String id : dimension.values()) {
      if (id != null && id.equalsIgnoreCase(raw)) {
        return new ResolvedValue(id, false);
      }
    }
    return new ResolvedValue(null, false);
  }

  private List<GraphNodeFilterDto> listedDimensions() {
    List<GraphNodeFilterDto> dimensions = filterFacets.listNodeFilters();
    return dimensions != null ? dimensions : List.of();
  }

  private String refuse(String error, String detail) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("accepted", false);
    out.put("error", error);
    if (detail != null) {
      out.put("detail", detail);
    }
    return toJson(out);
  }

  private static Map<String, Object> axisSummary(String key, String label, List<String> values) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("key", key);
    row.put("label", label != null ? label : key);
    row.put("values", List.copyOf(values));
    return row;
  }

  private static boolean containsIgnoreCase(List<String> values, String candidate) {
    for (String value : values) {
      if (value.equalsIgnoreCase(candidate)) {
        return true;
      }
    }
    return false;
  }

  private static boolean equalsIgnoreCase(String left, String right) {
    return left != null && left.equalsIgnoreCase(right);
  }
  private static final class AxisCollector {
    private final Map<String, List<String>> nodeAttributes = new LinkedHashMap<>();
    private final Map<String, List<String>> nodeRefs = new LinkedHashMap<>();
    private final Map<String, List<String>> edgeAttributes = new LinkedHashMap<>();
    private final List<Map<String, String>> ignored = new ArrayList<>();
    private final List<Map<String, Object>> summary = new ArrayList<>();
    private String detail;

    private Map<String, List<String>> target(String kind) {
      if ("NODE_REF".equals(kind)) {
        return nodeRefs;
      }
      if ("EDGE".equals(kind)) {
        return edgeAttributes;
      }
      return nodeAttributes;
    }
  }

  private record DimensionMatch(GraphNodeFilterDto dimension, String error) {}

  private record ResolvedValue(String value, boolean ambiguous) {}

  private record FilterDecision(
      boolean accepted,
      ChatMapFilters filters,
      String error,
      String detail,
      List<Map<String, String>> ignored,
      List<Map<String, Object>> summary) {

    private static FilterDecision refuse(String error, String detail) {
      return new FilterDecision(false, null, error, detail, List.of(), List.of());
    }

    private static FilterDecision accept(
        ChatMapFilters filters,
        List<Map<String, String>> ignored,
        List<Map<String, Object>> summary) {
      return new FilterDecision(true, filters, null, null, ignored, summary);
    }
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      return "{\"error\":\"json_serialization_failed\"}";
    }
  }
}
