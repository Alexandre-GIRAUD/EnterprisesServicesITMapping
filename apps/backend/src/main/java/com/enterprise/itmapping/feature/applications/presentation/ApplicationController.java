package com.enterprise.itmapping.feature.applications.presentation;

import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionSuggestionService;
import com.enterprise.itmapping.feature.applications.application.ApplicationRegionLinkService;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.applications.application.ModuleSuggestionService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationBusinessUnitPatchRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRegionsPatchRequest;
import com.enterprise.itmapping.feature.businessunit.application.BusinessUnitApplicationLinkService;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import jakarta.validation.Valid;
import java.util.List;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/applications")
public class ApplicationController {

  private final ApplicationService applicationService;
  private final ModuleGraphService moduleGraphService;
  private final ModuleSuggestionService moduleSuggestionService;
  private final ApplicationConnectionSuggestionService connectionSuggestionService;
  private final BusinessUnitApplicationLinkService businessUnitApplicationLinkService;
  private final ApplicationRegionLinkService applicationRegionLinkService;

  public ApplicationController(
      ApplicationService applicationService,
      ModuleGraphService moduleGraphService,
      ModuleSuggestionService moduleSuggestionService,
      ApplicationConnectionSuggestionService connectionSuggestionService,
      BusinessUnitApplicationLinkService businessUnitApplicationLinkService,
      ApplicationRegionLinkService applicationRegionLinkService) {
    this.applicationService = applicationService;
    this.moduleGraphService = moduleGraphService;
    this.moduleSuggestionService = moduleSuggestionService;
    this.connectionSuggestionService = connectionSuggestionService;
    this.businessUnitApplicationLinkService = businessUnitApplicationLinkService;
    this.applicationRegionLinkService = applicationRegionLinkService;
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
   * Sets or clears the {@code HAS_APPLICATION} link from a {@code BusinessUnit} to this
   * application node. {@code businessUnitId} {@code null} removes any existing link.
   */
  @PatchMapping("/{id}/business-unit")
  public ResponseEntity<ApplicationResponse> patchBusinessUnit(
      @PathVariable String id,
      @RequestBody(required = false) ApplicationBusinessUnitPatchRequest body) {
    String buId = body != null ? body.businessUnitId() : null;
    if (!businessUnitApplicationLinkService.setBusinessUnitForApplication(id, buId)) {
      return ResponseEntity.notFound().build();
    }
    return applicationService
        .findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  /**
   * Replaces all {@code IS_USED_IN} links from this application to {@link
   * com.enterprise.itmapping.domain.Region} nodes (full replacement). Omitting {@code regionCodes}
   * or sending {@code []} clears all regions.
   */
  @PatchMapping("/{id}/regions")
  public ResponseEntity<ApplicationResponse> patchRegions(
      @PathVariable String id,
      @RequestBody(required = false) ApplicationRegionsPatchRequest body) {
    List<String> codes = body != null ? body.regionCodes() : null;
    if (!applicationRegionLinkService.setRegionsForApplication(id, codes)) {
      return ResponseEntity.notFound().build();
    }
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
