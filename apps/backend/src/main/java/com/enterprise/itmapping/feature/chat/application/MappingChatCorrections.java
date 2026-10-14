package com.enterprise.itmapping.feature.chat.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ApplicationNameMatch;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeRefPatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributePatchService;
import com.enterprise.itmapping.feature.graph.application.GraphNeighborhoodService;
import com.enterprise.itmapping.feature.graph.application.GraphNodeFilterFacetService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeRequestDto;
import com.enterprise.itmapping.feature.graph.application.dto.CreateGraphEdgeResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto.GraphFilterOptionDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * One accepted Production correction per chat reply. Writes go through the same services as
 * Corrections and the details drawers.
 */
public class MappingChatCorrections {

  private static final String DEFAULT_FLOW_TYPE = "DEPENDS_ON";

  private final ApplicationService applicationService;
  private final GraphService graphService;
  private final ApplicationNodeAttributePatchService nodeAttributes;
  private final ApplicationNodeRefPatchService nodeRefs;
  private final GraphEdgeAttributePatchService edgeAttributes;
  private final GraphNeighborhoodService neighborhoodService;
  private final GraphNodeFilterFacetService filterFacets;
  private final ApplicationCatalogQuery catalogQuery;
  private final ObjectMapper objectMapper;
  private boolean correctionAccepted;

  public MappingChatCorrections(
      ApplicationService applicationService,
      GraphService graphService,
      ApplicationNodeAttributePatchService nodeAttributes,
      ApplicationNodeRefPatchService nodeRefs,
      GraphEdgeAttributePatchService edgeAttributes,
      GraphNeighborhoodService neighborhoodService,
      GraphNodeFilterFacetService filterFacets,
      ApplicationCatalogQuery catalogQuery,
      ObjectMapper objectMapper) {
    this.applicationService = applicationService;
    this.graphService = graphService;
    this.nodeAttributes = nodeAttributes;
    this.nodeRefs = nodeRefs;
    this.edgeAttributes = edgeAttributes;
    this.neighborhoodService = neighborhoodService;
    this.filterFacets = filterFacets;
    this.catalogQuery = catalogQuery;
    this.objectMapper = objectMapper;
  }

  public boolean graphChanged() {
    return correctionAccepted;
  }

  public CorrectionOutcome createApplication(String json) {
    if (correctionAccepted) {
      return refuse("one_correction", null);
    }
    JsonNode body = read(json);
    if (body == null) {
      return refuse("invalid_json", null);
    }
    String name = text(body, "name");
    if (!StringUtils.hasText(name)) {
      return refuse("empty_name", null);
    }
    String description = text(body, "description");
    ApplicationResponse created =
        applicationService.create(
            new ApplicationRequest(name.trim(), StringUtils.hasText(description) ? description.trim() : null));
    correctionAccepted = true;
    return accept(
        Map.of("name", created.name()),
        ChatCitationType.APPLICATION,
        created.id(),
        created.name());
  }

  public CorrectionOutcome createFlow(String json) {
    if (correctionAccepted) {
      return refuse("one_correction", null);
    }
    JsonNode body = read(json);
    if (body == null) {
      return refuse("invalid_json", null);
    }
    AttributeChangeMetaDto reason = reason(body);
    if (reason == null) {
      return refuse(reasonError(body), null);
    }
    CatalogRow source = resolveApplication(text(body, "source"));
    if (source == null) {
      return refuse("application_not_resolved", text(body, "source"));
    }
    CatalogRow target = resolveApplication(text(body, "target"));
    if (target == null) {
      return refuse("application_not_resolved", text(body, "target"));
    }
    if (source.id().equals(target.id())) {
      return refuse("same_application", source.name());
    }
    String type = text(body, "type");
    String flowType = StringUtils.hasText(type) ? type.trim().toUpperCase() : DEFAULT_FLOW_TYPE;
    try {
      CreateGraphEdgeResponseDto created =
          graphService.createEdge(
              new CreateGraphEdgeRequestDto(source.id(), target.id(), flowType, reason));
      correctionAccepted = true;
      String label = source.name() + " → " + target.name();
      return accept(Map.of("type", created.type(), "label", label), ChatCitationType.EDGE, created.id(), label);
    } catch (ResponseStatusException ex) {
      return refuse("write_rejected", ex.getReason());
    }
  }

  public CorrectionOutcome setNodeProperties(String json) {
    if (correctionAccepted) {
      return refuse("one_correction", null);
    }
    JsonNode body = read(json);
    if (body == null) {
      return refuse("invalid_json", null);
    }
    AttributeChangeMetaDto reason = reason(body);
    if (reason == null) {
      return refuse(reasonError(body), null);
    }
    CatalogRow application = resolveApplication(text(body, "application"));
    if (application == null) {
      return refuse("application_not_resolved", text(body, "application"));
    }
    List<GraphNodeFilterDto> dimensions = listed();
    Map<String, Object> attributes = new LinkedHashMap<>();
    Map<String, List<String>> refs = new LinkedHashMap<>();
    String error = fillNode(body, dimensions, attributes, refs);
    if (error != null) {
      return refuse(error, null);
    }
    if (attributes.isEmpty() && refs.isEmpty()) {
      return refuse("nothing_to_change", null);
    }
    if (!attributes.isEmpty()) {
      nodeAttributes.patchHuman(application.id(), attributes, reason);
    }
    if (!refs.isEmpty()) {
      nodeRefs.patch(application.id(), refs);
    }
    correctionAccepted = true;
    return accept(
        Map.of("application", application.name()),
        ChatCitationType.APPLICATION,
        application.id(),
        application.name());
  }

  public CorrectionOutcome setFlowProperties(String json) {
    if (correctionAccepted) {
      return refuse("one_correction", null);
    }
    JsonNode body = read(json);
    if (body == null) {
      return refuse("invalid_json", null);
    }
    AttributeChangeMetaDto reason = reason(body);
    if (reason == null) {
      return refuse(reasonError(body), null);
    }
    CatalogRow source = resolveApplication(text(body, "source"));
    if (source == null) {
      return refuse("application_not_resolved", text(body, "source"));
    }
    CatalogRow target = resolveApplication(text(body, "target"));
    if (target == null) {
      return refuse("application_not_resolved", text(body, "target"));
    }
    List<String> edgeIds = neighborhoodService.dependsOnIdsBetween(source.id(), target.id());
    if (edgeIds.isEmpty()) {
      return refuse("flow_not_found", source.name() + " → " + target.name());
    }
    if (edgeIds.size() > 1) {
      return refuse("ambiguous_flow", source.name() + " → " + target.name());
    }
    Map<String, Object> attributes = new LinkedHashMap<>();
    String error = fillEdge(body, listed(), attributes);
    if (error != null) {
      return refuse(error, null);
    }
    if (attributes.isEmpty()) {
      return refuse("nothing_to_change", null);
    }
    edgeAttributes.patchHuman(edgeIds.getFirst(), attributes, reason);
    correctionAccepted = true;
    String label = source.name() + " → " + target.name();
    return accept(Map.of("label", label), ChatCitationType.EDGE, edgeIds.getFirst(), label);
  }

  private String fillNode(
      JsonNode body,
      List<GraphNodeFilterDto> dimensions,
      Map<String, Object> attributes,
      Map<String, List<String>> refs) {
    String clearAttributes = putClears(body.get("clearNodeAttributes"), "NODE", dimensions, attributes);
    if (clearAttributes != null) {
      return clearAttributes;
    }
    String clearRefs = putClears(body.get("clearNodeRefs"), "NODE_REF", dimensions, refs);
    if (clearRefs != null) {
      return clearRefs;
    }
    String values = putValues(body.get("nodeAttributes"), "NODE", dimensions, attributes);
    if (values != null) {
      return values;
    }
    return putRefValues(body.get("nodeRefs"), dimensions, refs);
  }

  private String fillEdge(
      JsonNode body, List<GraphNodeFilterDto> dimensions, Map<String, Object> attributes) {
    String cleared = putClears(body.get("clearEdgeAttributes"), "EDGE", dimensions, attributes);
    if (cleared != null) {
      return cleared;
    }
    return putValues(body.get("edgeAttributes"), "EDGE", dimensions, attributes);
  }

  private String putClears(
      JsonNode node, String kind, List<GraphNodeFilterDto> dimensions, Map<String, ?> target) {
    if (node == null || !node.isArray()) {
      return null;
    }
    for (JsonNode item : node) {
      GraphNodeFilterDto dimension = match(dimensions, item.asText(), kind);
      if (dimension == null) {
        return "unknown_key";
      }
      putBlank(target, dimension);
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  private static void putBlank(Map<String, ?> target, GraphNodeFilterDto dimension) {
    if ("NODE_REF".equals(dimension.kind())) {
      ((Map<String, List<String>>) target).put(dimension.key(), List.of());
      return;
    }
    ((Map<String, Object>) target).put(dimension.key(), "");
  }

  private String putValues(
      JsonNode node, String kind, List<GraphNodeFilterDto> dimensions, Map<String, Object> target) {
    if (node == null || !node.isObject()) {
      return null;
    }
    var fields = node.fields();
    while (fields.hasNext()) {
      var entry = fields.next();
      GraphNodeFilterDto dimension = match(dimensions, entry.getKey(), kind);
      if (dimension == null) {
        return "unknown_key";
      }
      List<String> raw = texts(entry.getValue());
      List<String> kept = canonical(dimension, raw);
      if (kept == null) {
        return "invalid_value";
      }
      if (!dimension.multiple() && kept.size() > 1) {
        return "invalid_value";
      }
      target.put(dimension.key(), dimension.multiple() ? kept : kept.getFirst());
    }
    return null;
  }

  private String putRefValues(
      JsonNode node, List<GraphNodeFilterDto> dimensions, Map<String, List<String>> target) {
    if (node == null || !node.isObject()) {
      return null;
    }
    var fields = node.fields();
    while (fields.hasNext()) {
      var entry = fields.next();
      GraphNodeFilterDto dimension = match(dimensions, entry.getKey(), "NODE_REF");
      if (dimension == null) {
        return "unknown_key";
      }
      List<String> ids = refIds(dimension, texts(entry.getValue()));
      if (ids == null) {
        return "invalid_value";
      }
      if (!dimension.multiple() && ids.size() > 1) {
        return "invalid_value";
      }
      target.put(dimension.key(), ids);
    }
    return null;
  }

  private List<String> canonical(GraphNodeFilterDto dimension, List<String> raw) {
    if (raw.isEmpty()) {
      return null;
    }
    List<String> kept = new ArrayList<>();
    for (String value : raw) {
      if (!dimension.fromAllowedValues()) {
        kept.add(value);
        continue;
      }
      String match = null;
      for (String allowed : dimension.values()) {
        if (allowed != null && allowed.equalsIgnoreCase(value)) {
          match = allowed;
          break;
        }
      }
      if (match == null) {
        return null;
      }
      if (!contains(kept, match)) {
        kept.add(match);
      }
    }
    return kept;
  }

  private List<String> refIds(GraphNodeFilterDto dimension, List<String> raw) {
    if (raw.isEmpty()) {
      return null;
    }
    List<String> ids = new ArrayList<>();
    for (String value : raw) {
      String id = null;
      int nameHits = 0;
      for (GraphFilterOptionDto option : dimension.options()) {
        if (option.id() != null && option.id().equalsIgnoreCase(value)) {
          id = option.id();
          nameHits = 1;
          break;
        }
        if (option.name() != null && option.name().equalsIgnoreCase(value)) {
          nameHits++;
          id = option.id();
        }
      }
      if (nameHits != 1 || id == null) {
        return null;
      }
      if (!contains(ids, id)) {
        ids.add(id);
      }
    }
    return ids;
  }

  private GraphNodeFilterDto match(List<GraphNodeFilterDto> dimensions, String keyOrLabel, String kind) {
    if (!StringUtils.hasText(keyOrLabel)) {
      return null;
    }
    String needle = keyOrLabel.trim();
    GraphNodeFilterDto byKey = null;
    GraphNodeFilterDto byLabel = null;
    for (GraphNodeFilterDto dimension : dimensions) {
      if (!kind.equals(dimension.kind())) {
        continue;
      }
      if (dimension.key() != null && dimension.key().equalsIgnoreCase(needle)) {
        byKey = dimension;
      } else if (dimension.label() != null && dimension.label().equalsIgnoreCase(needle)) {
        if (byLabel != null) {
          return null;
        }
        byLabel = dimension;
      }
    }
    return byKey != null ? byKey : byLabel;
  }

  private CatalogRow resolveApplication(String wording) {
    if (!StringUtils.hasText(wording)) {
      return null;
    }
    return ApplicationNameMatch.uniqueClosest(wording.trim(), catalogQuery.loadAllNamed());
  }

  private AttributeChangeMetaDto reason(JsonNode body) {
    String error = reasonError(body);
    if (error != null) {
      return null;
    }
    HumanChangeReason parsed = HumanChangeReason.fromApi(text(body, "reason"));
    String comment = text(body, "reasonComment");
    return new AttributeChangeMetaDto(parsed, StringUtils.hasText(comment) ? comment.trim() : null);
  }

  private String reasonError(JsonNode body) {
    String raw = text(body, "reason");
    if (!StringUtils.hasText(raw)) {
      return "reason_required";
    }
    HumanChangeReason parsed;
    try {
      parsed = HumanChangeReason.fromApi(raw);
    } catch (IllegalArgumentException ex) {
      return "unknown_reason";
    }
    if (parsed == HumanChangeReason.Others && !StringUtils.hasText(text(body, "reasonComment"))) {
      return "reason_comment_required";
    }
    return null;
  }

  private List<GraphNodeFilterDto> listed() {
    List<GraphNodeFilterDto> dimensions = filterFacets.listNodeFilters();
    return dimensions != null ? dimensions : List.of();
  }

  private JsonNode read(String json) {
    if (!StringUtils.hasText(json)) {
      return null;
    }
    try {
      JsonNode node = objectMapper.readTree(json);
      return node != null && node.isObject() ? node : null;
    } catch (JsonProcessingException ex) {
      return null;
    }
  }

  private static String text(JsonNode body, String field) {
    JsonNode node = body.get(field);
    if (node == null || node instanceof MissingNode || node.isNull()) {
      return "";
    }
    return node.asText("");
  }

  private static List<String> texts(JsonNode node) {
    List<String> values = new ArrayList<>();
    if (node == null || node.isNull()) {
      return values;
    }
    if (node.isArray()) {
      for (JsonNode item : node) {
        if (item != null && StringUtils.hasText(item.asText())) {
          values.add(item.asText().trim());
        }
      }
      return values;
    }
    if (StringUtils.hasText(node.asText())) {
      values.add(node.asText().trim());
    }
    return values;
  }

  private static boolean contains(List<String> values, String candidate) {
    for (String value : values) {
      if (value.equalsIgnoreCase(candidate)) {
        return true;
      }
    }
    return false;
  }

  private CorrectionOutcome accept(
      Map<String, Object> applied, ChatCitationType type, String id, String label) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("accepted", true);
    out.put("applied", applied);
    return new CorrectionOutcome(write(out), type, id, label, true);
  }

  private CorrectionOutcome refuse(String error, String detail) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("accepted", false);
    out.put("error", error);
    if (detail != null) {
      out.put("detail", detail);
    }
    return new CorrectionOutcome(write(out), null, null, null, false);
  }

  private String write(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException ex) {
      return "{\"accepted\":false,\"error\":\"invalid_json\"}";
    }
  }

  public record CorrectionOutcome(
      String json, ChatCitationType type, String id, String label, boolean changed) {}
}
