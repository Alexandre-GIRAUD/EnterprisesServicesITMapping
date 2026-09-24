package com.enterprise.itmapping.feature.chat.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse.ChatCitationDto;
import com.enterprise.itmapping.feature.functionaldoc.application.FunctionalDocumentationService;
import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload;
import com.enterprise.itmapping.feature.functionaldoc.domain.FunctionalDocStatus;
import com.enterprise.itmapping.feature.functionaldoc.presentation.dto.FunctionalDocumentationResponse;
import com.enterprise.itmapping.feature.graph.application.GraphNeighborhoodService;
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
 * Read-only tools for the mapping chat agent. One instance per ask request so citations accumulate
 * safely.
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

  private final LinkedHashSet<String> citationKeys = new LinkedHashSet<>();
  private final List<ChatCitationDto> citations = new ArrayList<>();
  private final List<String> warnings = new ArrayList<>();

  public MappingChatTools(
      ApplicationCatalogQuery catalogQuery,
      GraphNeighborhoodService neighborhoodService,
      ApplicationService applicationService,
      FunctionalDocumentationService documentationService,
      ModuleGraphService moduleGraphService,
      FunctionalDocSearchService docSearchService,
      MappingChatProperties properties,
      ObjectMapper objectMapper) {
    this.catalogQuery = catalogQuery;
    this.neighborhoodService = neighborhoodService;
    this.applicationService = applicationService;
    this.documentationService = documentationService;
    this.moduleGraphService = moduleGraphService;
    this.docSearchService = docSearchService;
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  public List<ChatCitationDto> citations() {
    return List.copyOf(citations);
  }

  public List<String> warnings() {
    return List.copyOf(warnings);
  }

  @Tool(
      description =
          "Semantic search across stored functional documentation (READY docs only). "
              + "Use for business questions when the application name is unknown or fuzzy "
              + "(e.g. which apps handle payments, claims, onboarding). "
              + "Optional applicationId scopes search to one app. "
              + "Do NOT use this for topology / DEPENDS_ON / who-is-connected questions.")
  public String searchFunctionalDocs(
      @ToolParam(description = "Natural language query") String query,
      @ToolParam(description = "Optional application id to scope search", required = false)
          String applicationId) {
    if (docSearchService == null) {
      return toJson(Map.of("note", "empty", "hits", List.of(), "error", "rag_unavailable"));
    }
    try {
      FunctionalDocSearchResponse res = docSearchService.search(query, applicationId, null);
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
          "Resolve application names to catalogue entries (id, name, description). "
              + "Call this first when the user mentions an application by name.")
  public String resolveApplications(
      @ToolParam(description = "Application name or partial name") String query) {
    List<CatalogRow> rows = catalogQuery.loadMatching(query, properties.maxResolveResults());
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
              applicationId, dir, properties.maxNeighborhoodEdges());
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
    Optional<ApplicationResponse> opt = applicationService.findById(applicationId);
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
    FunctionalDocumentationResponse doc = documentationService.get(applicationId);
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
    Optional<GraphResponseDto> opt = moduleGraphService.getModuleGraph(applicationId);
    if (opt.isEmpty()) {
      return toJson(Map.of("error", "application_not_found", "applicationId", applicationId));
    }
    GraphResponseDto graph = opt.get();
    addCitation(ChatCitationType.APPLICATION, applicationId, applicationId);
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
    out.put("applicationId", applicationId);
    out.put("moduleCount", modules.size());
    out.put("modules", modules);
    out.put("edgeCount", graph.edges() != null ? graph.edges().size() : 0);
    return toJson(out);
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
