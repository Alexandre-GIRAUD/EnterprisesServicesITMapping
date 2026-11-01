package com.enterprise.itmapping.feature.applications.presentation;

import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionSuggestionService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeRefPatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.BusinessModelPatchService;
import com.enterprise.itmapping.feature.applications.application.ModuleDetailsPatchService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.applications.application.ModuleSuggestionService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationNodeAttributesPatchRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationNodeRefsPatchRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.BusinessModelPatchRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ModuleDetailsPatchRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/applications")
public class ApplicationController {

  private final ApplicationService applicationService;
  private final ModuleGraphService moduleGraphService;
  private final ModuleDetailsPatchService moduleDetailsPatchService;
  private final BusinessModelPatchService businessModelPatchService;
  private final ModuleSuggestionService moduleSuggestionService;
  private final ApplicationConnectionSuggestionService connectionSuggestionService;
  private final ApplicationNodeAttributePatchService nodeAttributePatchService;
  private final ApplicationNodeRefPatchService nodeRefPatchService;

  public ApplicationController(
      ApplicationService applicationService,
      ModuleGraphService moduleGraphService,
      ModuleDetailsPatchService moduleDetailsPatchService,
      BusinessModelPatchService businessModelPatchService,
      ModuleSuggestionService moduleSuggestionService,
      ApplicationConnectionSuggestionService connectionSuggestionService,
      ApplicationNodeAttributePatchService nodeAttributePatchService,
      ApplicationNodeRefPatchService nodeRefPatchService) {
    this.applicationService = applicationService;
    this.moduleGraphService = moduleGraphService;
    this.moduleDetailsPatchService = moduleDetailsPatchService;
    this.businessModelPatchService = businessModelPatchService;
    this.moduleSuggestionService = moduleSuggestionService;
    this.connectionSuggestionService = connectionSuggestionService;
    this.nodeAttributePatchService = nodeAttributePatchService;
    this.nodeRefPatchService = nodeRefPatchService;
  }

  @GetMapping
  public List<ApplicationResponse> list() {
    return applicationService.findAll();
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApplicationResponse> get(@PathVariable String id) {
    return applicationService.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  /**
   * Builds {@code Module} subgraph from GitHub tree paths + LLM suggestion.
   * Structural edges are persisted as {@code CONTAINS} only (see {@link ModuleSuggestionService}
   * documentation).
   */
  @PostMapping("/{id}/modules/suggest-from-github")
  public ResponseEntity<SuggestModulesFromGithubResponse> suggestModulesFromGithub(
      @PathVariable String id,
      @RequestBody(required = false) SuggestModulesFromGithubRequest body
  ) {
    SuggestModulesFromGithubResponse response =
        moduleSuggestionService.suggestFromGithub(id, body != null ? body : new SuggestModulesFromGithubRequest(null));
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  /**
   * Infers application-to-application integration connections (outbound + inbound) from the GitHub
   * repository code and persists them as {@code DEPENDS_ON} edges between {@code Application} nodes.
   * Idempotent: re-runs skip duplicate edges (see {@link ApplicationConnectionSuggestionService}).
   */
  @PostMapping("/{id}/connections/suggest-from-github")
  public ResponseEntity<SuggestConnectionsFromGithubResponse> suggestConnectionsFromGithub(
      @PathVariable String id,
      @RequestBody(required = false) SuggestConnectionsFromGithubRequest body) {
    SuggestConnectionsFromGithubResponse response =
        connectionSuggestionService.suggestFromGithub(
            id, body != null ? body : new SuggestConnectionsFromGithubRequest(null));
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  /**
   * Module composition tree for one application (same JSON shape as {@code GET /graph} for
   * Cytoscape). 404 when the application id is unknown; 200 with root only when there are no modules.
   */
  @GetMapping("/{id}/module-graph")
  public ResponseEntity<GraphResponseDto> getModuleGraph(@PathVariable String id) {
    return moduleGraphService
        .getModuleGraph(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  /**
   * Edits a functional module: description, business owner, actors, trigger and the business objects it consumes and produces. Fields left out
   * stay as they are; each change lands in the application history. Human edits need
   * {@code changeMeta.reason}.
   */
  @PatchMapping("/{id}/modules/{moduleId}")
  public ResponseEntity<GraphResponseDto> patchModule(
      @PathVariable String id,
      @PathVariable String moduleId,
      @RequestBody ModuleDetailsPatchRequest body) {
    moduleDetailsPatchService.patchHuman(id, moduleId, body.toPatch(), body.changeMeta());
    return moduleGraphService
        .getModuleGraph(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  /**
   * Edits the business model of an application: lexicon of business objects, explicit links between
   * its modules, main journey and scope. Parts left out stay as they are; each change lands in the
   * application history. Human edits need {@code changeMeta.reason}.
   */
  @PatchMapping("/{id}/business-model")
  public ResponseEntity<GraphResponseDto> patchBusinessModel(
      @PathVariable String id, @RequestBody BusinessModelPatchRequest body) {
    businessModelPatchService.patchHuman(id, body.toPatch(), body.changeMeta());
    return moduleGraphService
        .getModuleGraph(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PostMapping
  public ResponseEntity<ApplicationResponse> create(@Valid @RequestBody ApplicationRequest request) {
    ApplicationResponse created = applicationService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @PutMapping("/{id}")
  public ResponseEntity<ApplicationResponse> update(
      @PathVariable String id,
      @Valid @RequestBody ApplicationRequest request
  ) {
    return applicationService.update(id, request)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  /**
   * Partially updates the Data Model {@code target=NODE} attributes stored as flat properties on the
   * Application node. Submitted keys that are not Data Model NODE fields are ignored; a blank value
   * clears the property.
   */
  @PatchMapping("/{id}/node-attributes")
  public ResponseEntity<ApplicationResponse> patchNodeAttributes(
      @PathVariable String id,
      @RequestBody(required = false) ApplicationNodeAttributesPatchRequest body) {
    if (applicationService.findById(id).isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    Map<String, Object> attributes = body != null ? body.attributes() : Map.of();
    if (body != null && body.changeMeta() != null) {
      nodeAttributePatchService.patchHuman(id, attributes, body.changeMeta());
    } else {
      // AI / legacy callers without changeMeta
      nodeAttributePatchService.patchAi(id, attributes, "API_PATCH");
    }
    return applicationService
        .findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  /**
   * Replaces {@code CLASSIFIED_AS} links for submitted Data Model {@code NODE_REF} keys. Values are
   * catalogue ref ids; an empty list clears that key.
   */
  @PatchMapping("/{id}/node-refs")
  public ResponseEntity<ApplicationResponse> patchNodeRefs(
      @PathVariable String id,
      @RequestBody(required = false) ApplicationNodeRefsPatchRequest body) {
    if (applicationService.findById(id).isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    Map<String, List<String>> refs = body != null ? body.refs() : Map.of();
    nodeRefPatchService.patch(id, refs);
    return applicationService
        .findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    return applicationService.delete(id)
        ? ResponseEntity.noContent().build()
        : ResponseEntity.notFound().build();
  }
}
