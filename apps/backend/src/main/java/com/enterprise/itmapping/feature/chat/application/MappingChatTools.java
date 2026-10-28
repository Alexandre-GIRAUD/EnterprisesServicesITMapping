package com.enterprise.itmapping.feature.chat.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ApplicationNameMatch;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeRefPatchService;
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
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributePatchService;
import com.enterprise.itmapping.feature.graph.application.GraphNeighborhoodService;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.GraphNodeFilterFacetService;
import com.enterprise.itmapping.feature.graph.application.dto.ApplicationNeighborhoodDto;
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
 * Tools for one mapping-chat question. Read tools do not write. {@code applyMapFilters} only changes
 * the map filters. The four correction tools write through the same services as Corrections and the
 * drawers, at most once per reply. One instance per ask.
 */
public class MappingChatTools {

  private final ApplicationCatalogQuery catalogQuery;
  private final GraphNeighborhoodService neighborhoodService;
  private final ApplicationService applicationService;
  private final FunctionalDocumentationService documentationService;
  private final ModuleGraphService moduleGraphService;
  private final FunctionalDocSearchService docSearchService;
  private final MappingChatProperties properties;
  private final ObjectMapper objectMapper;
  private final MappingChatCorrections corrections;

  private final LinkedHashSet<String> citationKeys = new LinkedHashSet<>();
  private final List<ChatCitationDto> citations = new ArrayList<>();
  private final List<String> warnings = new ArrayList<>();
  private final MappingChatFilters filters;
  private ChatMapFilters appliedFilters;
  private boolean graphChanged;

  public MappingChatTools(
      ApplicationCatalogQuery catalogQuery,
      GraphNeighborhoodService neighborhoodService,
      ApplicationService applicationService,
      FunctionalDocumentationService documentationService,
      ModuleGraphService moduleGraphService,
      FunctionalDocSearchService docSearchService,
      GraphNodeFilterFacetService filterFacets,
      GraphService graphService,
      ApplicationNodeAttributePatchService nodeAttributes,
      ApplicationNodeRefPatchService nodeRefs,
      GraphEdgeAttributePatchService edgeAttributes,
      MappingChatProperties properties,
      ObjectMapper objectMapper) {
    this.catalogQuery = catalogQuery;
    this.neighborhoodService = neighborhoodService;
    this.applicationService = applicationService;
    this.documentationService = documentationService;
    this.moduleGraphService = moduleGraphService;
    this.docSearchService = docSearchService;
    this.properties = properties;
    this.filters = new MappingChatFilters(filterFacets, catalogQuery, objectMapper);
    this.objectMapper = objectMapper;
    this.corrections =
        new MappingChatCorrections(
            applicationService,
            graphService,
            nodeAttributes,
            nodeRefs,
            edgeAttributes,
            neighborhoodService,
            filterFacets,
            catalogQuery,
            objectMapper);
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

  /** True after one correction tool has written. */
  public boolean graphChanged() {
    return graphChanged;
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
          "Create an Application on the Production graph. JSON {name, description?}. "
              + "No change reason. Refuses an empty name. One correction per reply.")
  public String createApplication(
      @ToolParam(description = "JSON {name, description?}") String applicationJson) {
    return finish(corrections.createApplication(applicationJson));
  }

  @Tool(
      description =
          "Create a flow between two existing applications. JSON {source, target, type?, reason, reasonComment?}. "
              + "type defaults to DEPENDS_ON. reason is MissedOnScan, NotInSources, WrongData, WrongFormat, "
              + "WrongSpelling, OutdatedData, or Others. Others requires reasonComment. One correction per reply.")
  public String createFlow(@ToolParam(description = "JSON flow to create") String flowJson) {
    return finish(corrections.createFlow(flowJson));
  }

  @Tool(
      description =
          "Set application properties. JSON {application, reason, reasonComment?, nodeAttributes?, nodeRefs?, "
              + "clearNodeAttributes?, clearNodeRefs?}. Omit a property to leave it. "
              + "clearNodeAttributes and clearNodeRefs empty that property only. "
              + "NODE_REF values may be display names. One correction per reply.")
  public String setNodeProperties(
      @ToolParam(description = "JSON node property change") String propertiesJson) {
    return finish(corrections.setNodeProperties(propertiesJson));
  }

  @Tool(
      description =
          "Set properties of the single DEPENDS_ON flow between two applications. "
              + "JSON {source, target, reason, reasonComment?, edgeAttributes?, clearEdgeAttributes?}. "
              + "Refuses when there is not exactly one flow. One correction per reply.")
  public String setFlowProperties(
      @ToolParam(description = "JSON flow property change") String propertiesJson) {
    return finish(corrections.setFlowProperties(propertiesJson));
  }

  private String finish(MappingChatCorrections.CorrectionOutcome outcome) {
    if (outcome.changed()) {
      graphChanged = true;
      addCitation(outcome.type(), outcome.id(), outcome.label());
    }
    return outcome.json();
  }

  @Tool(
      description =
          "List Production map filter dimensions: key, label, kind (NODE, NODE_REF, EDGE), and values. "
              + "NODE_REF options include catalogue id and display name. "
              + "The user asks in English. Map those words to a key, label, or value from this list. "
              + "Call this before applyMapFilters when the field key is not obvious.")
  public String listFilterDimensions() {
    return filters.listJson();
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
    MappingChatFilters.Result result = filters.apply(filtersJson);
    if (result.filters() != null) {
      appliedFilters = result.filters();
    }
    return result.json();
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

}
