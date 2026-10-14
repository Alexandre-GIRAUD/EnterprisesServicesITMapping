package com.enterprise.itmapping.feature.chat.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ApplicationNameMatch;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse.ChatCitationDto;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatMapFilters;
import com.enterprise.itmapping.feature.functionaldoc.application.FunctionalDocumentationService;
import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload;
import com.enterprise.itmapping.feature.functionaldoc.domain.FunctionalDocStatus;
import com.enterprise.itmapping.feature.functionaldoc.presentation.dto.FunctionalDocumentationResponse;
import com.enterprise.itmapping.feature.graph.application.GraphNeighborhoodService;
import com.enterprise.itmapping.feature.graph.application.GraphNodeFilterFacetService;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto.GraphFilterOptionDto;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto.NeighborhoodEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.domain.NeighborhoodDirection;
import com.enterprise.itmapping.feature.integrations.llm.MappingChatProperties;
import com.enterprise.itmapping.feature.rag.application.FunctionalDocSearchService;
import com.enterprise.itmapping.feature.rag.presentation.dto.FunctionalDocSearchResponse;
import com.enterprise.itmapping.feature.rag.presentation.dto.FunctionalDocSearchResponse.HitDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Tools for one mapping-chat question. Graph tools only read. {@code applyMapFilters} records a map
 * filter set for the client; it does not write the graph. One instance per ask so citations and the
 * accepted filter set accumulate safely.
 */
public class MappingChatTools {

  private final ApplicationCatalogQuery catalogQuery;
  private final GraphNeighborhoodService neighborhoodService;
  private final ApplicationService applicationService;
  private final FunctionalDocumentationService documentationService;
  private final ModuleGraphService moduleGraphService;
  private final FunctionalDocSearchService docSearchService;
  private final GraphNodeFilterFacetService filterFacets;
  private final MappingChatProperties properties;
  private final ObjectMapper objectMapper;

  private final LinkedHashSet<String> citationKeys = new LinkedHashSet<>();
  private final List<ChatCitationDto> citations = new ArrayList<>();
  private final List<String> warnings = new ArrayList<>();
  private ChatMapFilters appliedFilters;

  public MappingChatTools(
      ApplicationCatalogQuery catalogQuery,
      GraphNeighborhoodService neighborhoodService,
      ApplicationService applicationService,
      FunctionalDocumentationService documentationService,
      ModuleGraphService moduleGraphService,
      FunctionalDocSearchService docSearchService,
      GraphNodeFilterFacetService filterFacets,
      MappingChatProperties properties,
      ObjectMapper objectMapper) {
    this.catalogQuery = catalogQuery;
    this.neighborhoodService = neighborhoodService;
    this.applicationService = applicationService;
    this.documentationService = documentationService;
    this.moduleGraphService = moduleGraphService;
    this.docSearchService = docSearchService;
    this.filterFacets = filterFacets;
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  public List<ChatCitationDto> citations() {
    return List.copyOf(citations);
  }

  public List<String> warnings() {
    return List.copyOf(warnings);
  }

  /** Null until a call to {@code applyMapFilters} is accepted. A later refusal leaves this set. */
  public ChatMapFilters appliedFilters() {
    return appliedFilters;
  }

  @Tool(
      description =
          "Semantic search across stored functional documentation (READY docs only). "
              + "Use for business questions when the application name is unknown or fuzzy "
              + "(e.g. which apps handle payments, claims, onboarding). "
              + "Optional applicationId scopes search to one app. "
              + "Do NOT use this for topology / DEPENDS_ON / who-is-connected questions.")
  public String searchFunctionalDocs(
      @ToolParam(description = "English question, as the user wrote it") String query,
      @ToolParam(description = "Optional application id to scope search", required = false)
          String applicationId) {
    if (docSearchService == null) {
      return toJson(Map.of("note", "empty", "hits", List.of(), "error", "rag_unavailable"));
    }
    try {
      FunctionalDocSearchResponse res =
          docSearchService.search(query, storedApplicationId(applicationId), null);
      if (res.hits().isEmpty()) {
        warnings.add("No relevant functional documentation chunks found for this query.");
      }
      List<Map<String, Object>> hits = new ArrayList<>();
      for (HitDto hit : res.hits()) {
        String label =
            "Doc · "
                + (hit.sectionTitle() != null ? hit.sectionTitle() : hit.sectionKey())
                + " · "
                + hit.applicationName();
        addCitation(ChatCitationType.FUNCTIONAL_DOC, hit.applicationId(), label);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("applicationId", hit.applicationId());
        m.put("applicationName", hit.applicationName());
        m.put("sectionKey", hit.sectionKey());
        m.put("sectionTitle", hit.sectionTitle());
        m.put("content", hit.content());
        m.put("score", hit.score());
        hits.add(m);
      }
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("query", res.query());
      out.put("hits", hits);
      out.put("note", res.note());
      return toJson(out);
    } catch (ResponseStatusException ex) {
      return toJson(
          Map.of(
              "note",
              "empty",
              "hits",
              List.of(),
              "error",
              ex.getReason() != null ? ex.getReason() : ex.getStatusCode().toString()));
    }
  }

  @Tool(
      description =
          "Resolve an application name or id, including a small typo or a difference of spaces and underscores. "
              + "Call this first when the user mentions an application. "
              + "If several matches are similarly close, ask which one is meant.")
  public String resolveApplications(
      @ToolParam(description = "Application name or id in English, as the user wrote it") String query) {
    List<CatalogRow> rows =
        ApplicationNameMatch.closest(query, catalogQuery.loadAllNamed(), properties.maxResolveResults());
    if (rows.isEmpty()) {
      return toJson(Map.of("matches", List.of(), "note", "none"));
    }
    List<Map<String, String>> matches = new ArrayList<>();
    for (CatalogRow row : rows) {
      addCitation(ChatCitationType.APPLICATION, row.id(), row.name());
      Map<String, String> m = new LinkedHashMap<>();
      m.put("id", row.id());
      m.put("name", row.name());
      if (row.description() != null) {
        m.put("description", truncate(row.description(), 240));
      }
      matches.add(m);
    }
    return toJson(Map.of("matches", matches));
  }

  @Tool(
      description =
          "List DEPENDS_ON neighbors of an application (who connects to / from it) with edge "
              + "properties (channel, connection_kind, Data Model edge attrs). direction: BOTH, OUT, or IN.")
  public String getNeighborhood(
      @ToolParam(description = "Application id") String applicationId,
      @ToolParam(description = "BOTH, OUT, or IN", required = false) String direction) {
    NeighborhoodDirection dir;
    try {
      dir = NeighborhoodDirection.fromParam(direction);
    } catch (IllegalArgumentException ex) {
      dir = NeighborhoodDirection.BOTH;
    }
    try {
      ApplicationNeighborhoodDto nb =
          neighborhoodService.getNeighborhood(
              storedApplicationId(applicationId), dir, properties.maxNeighborhoodEdges());
      addCitation(
          ChatCitationType.APPLICATION,
          nb.application().id(),
          nb.application().name() != null ? nb.application().name() : nb.application().id());
      if (nb.truncated()) {
        warnings.add(
            "Neighborhood truncated to " + properties.maxNeighborhoodEdges() + " edges.");
      }
      List<Map<String, Object>> edgeMaps = new ArrayList<>();
      for (NeighborhoodEdgeDto e : nb.edges()) {
        String label =
            "OUT".equals(e.direction())
                ? nb.application().name() + " → " + e.otherName()
                : e.otherName() + " → " + nb.application().name();
        if (StringUtils.hasText(e.edgeId())) {
          addCitation(ChatCitationType.EDGE, e.edgeId(), label);
        }
        addCitation(ChatCitationType.APPLICATION, e.otherApplicationId(), e.otherName());
        Map<String, Object> em = new LinkedHashMap<>();
        em.put("edgeId", e.edgeId());
        em.put("direction", e.direction());
        em.put("otherApplicationId", e.otherApplicationId());
        em.put("otherName", e.otherName());
        em.put("properties", e.properties());
        edgeMaps.add(em);
      }
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("application", nb.application());
      out.put("edges", edgeMaps);
      out.put("truncated", nb.truncated());
      return toJson(out);
    } catch (ResponseStatusException ex) {
      if (ex.getStatusCode() == HttpStatus.NOT_FOUND) {
        return toJson(Map.of("error", "application_not_found", "applicationId", applicationId));
      }
      throw ex;
    }
  }

  @Tool(
      description =
          "Get application profile: id, name, description, node attributes and NODE_REF classifications.")
  public String getApplicationProfile(
      @ToolParam(description = "Application id") String applicationId) {
    Optional<ApplicationResponse> opt =
        applicationService.findById(storedApplicationId(applicationId));
    if (opt.isEmpty()) {
      return toJson(Map.of("error", "application_not_found", "applicationId", applicationId));
    }
    ApplicationResponse app = opt.get();
    addCitation(ChatCitationType.APPLICATION, app.id(), app.name());
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", app.id());
    out.put("name", app.name());
    out.put("description", app.description());
    out.put("nodeAttributes", app.nodeAttributes());
    out.put("nodeRefs", app.nodeRefs());
    out.put("hasModuleSubtree", app.hasModuleSubtree());
    return toJson(out);
  }

  @Tool(
      description =
          "Get stored functional documentation for an application (business summary, flows, "
              + "data concepts, integrations). Returns status if not READY.")
  public String getFunctionalDocumentation(
      @ToolParam(description = "Application id") String applicationId) {
    FunctionalDocumentationResponse doc =
        documentationService.get(storedApplicationId(applicationId));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("applicationId", doc.applicationId());
    out.put("status", doc.status() != null ? doc.status().name() : "MISSING");
    if (doc.status() != FunctionalDocStatus.READY || doc.payload() == null) {
      out.put(
          "note",
          "Functional documentation is not available (status="
              + out.get("status")
              + "). Do not invent business capabilities.");
      return toJson(out);
    }
    addCitation(
        ChatCitationType.FUNCTIONAL_DOC,
        doc.applicationId(),
        "Functional doc " + doc.applicationId());
    out.put("payload", payloadView(doc.payload()));
    return toJson(out);
  }

  @Tool(
      description =
          "Summarize the internal module composition graph (CONTAINS) for an application.")
  public String getModuleGraph(
      @ToolParam(description = "Application id") String applicationId) {
    String storedId = storedApplicationId(applicationId);
    Optional<GraphResponseDto> opt = moduleGraphService.getModuleGraph(storedId);
    if (opt.isEmpty()) {
      return toJson(Map.of("error", "application_not_found", "applicationId", applicationId));
    }
    GraphResponseDto graph = opt.get();
    addCitation(ChatCitationType.APPLICATION, storedId, storedId);
    List<Map<String, String>> modules = new ArrayList<>();
    int cap = properties.maxModulesInSummary();
    int count = 0;
    for (GraphNodeDto node : graph.nodes()) {
      if ("Application".equalsIgnoreCase(node.type())) {
        continue;
      }
      if (count >= cap) {
        warnings.add("Module list truncated to " + cap + " modules.");
        break;
      }
      Map<String, String> m = new LinkedHashMap<>();
      m.put("id", node.id());
      m.put("name", node.label());
      if (StringUtils.hasText(node.description())) {
        m.put("description", truncate(node.description(), 200));
      }
      modules.add(m);
      addCitation(ChatCitationType.MODULE, node.id(), node.label());
      count++;
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("applicationId", storedId);
    out.put("moduleCount", modules.size());
    out.put("modules", modules);
    out.put("edgeCount", graph.edges() != null ? graph.edges().size() : 0);
    return toJson(out);
  }

  @Tool(
      description =
          "List Production map filter dimensions: key, label, kind (NODE, NODE_REF, EDGE), and values. "
              + "NODE_REF options include catalogue id and display name. "
              + "The user asks in English. Map those words to a key, label, or value from this list. "
              + "Call this before applyMapFilters when the field key is not obvious.")
  public String listFilterDimensions() {
    return toJson(listedDimensions());
  }

  @Tool(
      description =
          "Replace the Production map filters. Does not write the graph. "
              + "The user asks in English. Send the stored key, label, or catalogue spelling, not a translation absent from listFilterDimensions. "
              + "JSON object with applicationIds, nodeAttributes, nodeRefs, edgeAttributes. "
              + "Each value is a JSON array of strings. Omit a key or send [] to leave that axis unfiltered. "
              + "{} clears every filter. Unknown keys refuse the whole set. "
              + "Unknown values in a known dimension are dropped; if none remain, the whole set is refused.")
  public String applyMapFilters(
      @ToolParam(description = "JSON filter set. {} clears every filter.") String filtersJson) {
    ChatMapFilters requested = readFilters(filtersJson);
    if (requested == null) {
      return refuse("invalid_json", null);
    }
    FilterDecision decision = resolveFilters(requested);
    if (!decision.accepted()) {
      return refuse(decision.error(), decision.detail());
    }
    appliedFilters = decision.filters();
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("accepted", true);
    out.put("applied", decision.summary());
    out.put("ignored", decision.ignored());
    return toJson(out);
  }

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

  private Map<String, Object> payloadView(AiFunctionalDocPayload payload) {
    Map<String, Object> view = new LinkedHashMap<>();
    String summary = payload.getSummary();
    if (summary != null && summary.length() > properties.maxDocChars()) {
      summary = truncate(summary, properties.maxDocChars());
      warnings.add("Functional documentation summary truncated.");
    }
    view.put("title", payload.getTitle());
    view.put("summary", summary);
    view.put("businessCapabilities", payload.getBusinessCapabilities());
    view.put("mainFlows", payload.getMainFlows());
    view.put("dataConcepts", payload.getDataConcepts());
    view.put("integrationsFunctional", payload.getIntegrationsFunctional());
    return view;
  }

  private String storedApplicationId(String raw) {
    if (!StringUtils.hasText(raw)) {
      return raw;
    }
    String trimmed = raw.trim();
    List<CatalogRow> catalogue = catalogQuery.loadAllNamed();
    CatalogRow unique = ApplicationNameMatch.uniqueClosest(trimmed, catalogue);
    return unique != null ? unique.id() : trimmed;
  }

  private void addCitation(ChatCitationType type, String id, String label) {
    if (!StringUtils.hasText(id)) {
      return;
    }
    String key = type.name() + ":" + id;
    if (citationKeys.add(key)) {
      citations.add(new ChatCitationDto(type, id, label != null ? label : id));
    }
  }

  private String truncate(String value, int max) {
    if (value == null) {
      return null;
    }
    String t = value.trim();
    if (t.length() <= max) {
      return t;
    }
    return t.substring(0, max) + "…";
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      return "{\"error\":\"json_serialization_failed\"}";
    }
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
}
