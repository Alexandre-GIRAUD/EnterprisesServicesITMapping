package com.enterprise.itmapping.feature.changedetection.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionSuggestionService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ModuleSuggestionService;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubRequest;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemKind;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemStatus;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionRunStatus;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionItemEntity;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionItemRepository;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionRunEntity;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionRunRepository;
import com.enterprise.itmapping.feature.changedetection.presentation.dto.ChangeDetectionItemDto;
import com.enterprise.itmapping.feature.changedetection.presentation.dto.ChangeDetectionRunDto;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubCommitDiffService;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubCommitDiffService.DiffResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ChangeDetectionService {

  private static final Logger log = LoggerFactory.getLogger(ChangeDetectionService.class);

  private final ChangeDetectionRunRepository runRepository;
  private final ChangeDetectionItemRepository itemRepository;
  private final LinkedApplicationResolver linkedApplicationResolver;
  private final GitHubCommitDiffService commitDiffService;
  private final DiffHeuristicAnalyzer heuristicAnalyzer;
  private final DataModelService dataModelService;
  private final GitHubIntegrationProperties githubProperties;
  private final ApplicationConnectionSuggestionService connectionSuggestionService;
  private final ModuleSuggestionService moduleSuggestionService;
  private final ApplicationNodeAttributePatchService nodeAttributePatchService;
  private final ObjectMapper objectMapper;
  private final ChangeDetectionService self;

  public ChangeDetectionService(
      ChangeDetectionRunRepository runRepository,
      ChangeDetectionItemRepository itemRepository,
      LinkedApplicationResolver linkedApplicationResolver,
      GitHubCommitDiffService commitDiffService,
      DiffHeuristicAnalyzer heuristicAnalyzer,
      DataModelService dataModelService,
      GitHubIntegrationProperties githubProperties,
      ApplicationConnectionSuggestionService connectionSuggestionService,
      ModuleSuggestionService moduleSuggestionService,
      ApplicationNodeAttributePatchService nodeAttributePatchService,
      ObjectMapper objectMapper,
      @Lazy ChangeDetectionService self) {
    this.runRepository = runRepository;
    this.itemRepository = itemRepository;
    this.linkedApplicationResolver = linkedApplicationResolver;
    this.commitDiffService = commitDiffService;
    this.heuristicAnalyzer = heuristicAnalyzer;
    this.dataModelService = dataModelService;
    this.githubProperties = githubProperties;
    this.connectionSuggestionService = connectionSuggestionService;
    this.moduleSuggestionService = moduleSuggestionService;
    this.nodeAttributePatchService = nodeAttributePatchService;
    this.objectMapper = objectMapper;
    this.self = self;
  }

  /**
   * Parses a GitHub push webhook, creates idempotent runs for each commit SHA, returns accepted run
   * ids. Processing continues asynchronously.
   */
  @Transactional
  public List<UUID> ingestPushWebhook(byte[] rawBody) {
    JsonNode root;
    try {
      root = objectMapper.readTree(rawBody);
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid JSON webhook body.", e);
    }

    String ref = text(root, "ref");
    String expectedBranch =
        StringUtils.hasText(githubProperties.webhookBranch())
            ? githubProperties.webhookBranch().trim()
            : "refs/heads/main";
    if (!expectedBranch.equals(ref)) {
      log.info("GitHub push ignored (branch): ref={} expected={}", ref, expectedBranch);
      return List.of();
    }

    String repoFullName = text(root.path("repository"), "full_name");
    if (!StringUtils.hasText(repoFullName) || !repoFullName.contains("/")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "repository.full_name missing.");
    }

    List<String> shas = new ArrayList<>();
    if (root.has("commits") && root.get("commits").isArray()) {
      for (JsonNode c : root.get("commits")) {
        String id = text(c, "id");
        if (StringUtils.hasText(id)) {
          shas.add(id);
        }
      }
    }
    String head = text(root.path("head_commit"), "id");
    if (StringUtils.hasText(head) && !shas.contains(head)) {
      shas.add(head);
    }
    if (shas.isEmpty()) {
      String after = text(root, "after");
      if (StringUtils.hasText(after) && !"0000000000000000000000000000000000000000".equals(after)) {
        shas.add(after);
      }
    }

    Optional<ApplicationGraphNodeProjection> app =
        linkedApplicationResolver.findByRepoFullName(repoFullName);
    List<UUID> accepted = new ArrayList<>();
    for (String sha : shas) {
      Optional<ChangeDetectionRunEntity> existing =
          runRepository.findByRepoFullNameIgnoreCaseAndCommitSha(repoFullName, sha);
      if (existing.isPresent()) {
        ChangeDetectionRunEntity run = existing.get();
        log.info(
            "GitHub push idempotent hit: repo={} commit={} status={}",
            repoFullName,
            shortSha(sha),
            run.getStatus());
        accepted.add(run.getId());
        continue;
      }
      ChangeDetectionRunEntity run = new ChangeDetectionRunEntity();
      run.setProvider("GITHUB");
      run.setRepoFullName(repoFullName);
      run.setCommitSha(sha);
      run.setBranchRef(ref);
      if (app.isPresent()) {
        run.setApplicationId(app.get().getId());
        run.setStatus(ChangeDetectionRunStatus.RECEIVED);
      } else {
        run.setStatus(ChangeDetectionRunStatus.UNMATCHED);
      }
      run = runRepository.save(run);
      accepted.add(run.getId());
      log.info(
          "GitHub push: repo={} commit={} applicationId={} status={}",
          repoFullName,
          shortSha(sha),
          run.getApplicationId(),
          run.getStatus());
      if (run.getStatus() != ChangeDetectionRunStatus.UNMATCHED) {
        self.processRunAsync(run.getId());
      }
    }
    return accepted;
  }

  @Async
  public void processRunAsync(UUID runId) {
    try {
      self.processRun(runId);
    } catch (Exception e) {
      log.error("Change detection processing failed runId={}", runId, e);
      runRepository
          .findById(runId)
          .ifPresent(
              run -> {
                run.setStatus(ChangeDetectionRunStatus.FAILED);
                run.setErrorMessage(e.getMessage());
                runRepository.save(run);
              });
    }
  }

  @Transactional
  public void processRun(UUID runId) {
    ChangeDetectionRunEntity run =
        runRepository
            .findById(runId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Run not found."));
    if (run.getStatus() == ChangeDetectionRunStatus.UNMATCHED) {
      return;
    }
    if (run.getStatus() == ChangeDetectionRunStatus.READY
        || run.getStatus() == ChangeDetectionRunStatus.EMPTY) {
      return;
    }
    run.setStatus(ChangeDetectionRunStatus.PROCESSING);
    runRepository.save(run);

    String[] parts = run.getRepoFullName().split("/", 2);
    String owner = parts[0];
    String repo = parts[1];
    DiffResult diff = commitDiffService.fetchCommitDiff(owner, repo, run.getCommitSha());
    DataModelConfig dm = dataModelService.loadConfig();
    DiffHeuristicAnalyzer.Analysis analysis = heuristicAnalyzer.analyze(diff.files(), dm);

    run.setTruncated(diff.truncated());
    run.setBuckets(new ArrayList<>(analysis.buckets()));
    run.setFiles(new ArrayList<>(analysis.files()));

    log.info(
        "GitHub push: repo={} commit={} applicationId={} files={} buckets={} truncated={}",
        run.getRepoFullName(),
        shortSha(run.getCommitSha()),
        run.getApplicationId(),
        analysis.files().size(),
        analysis.buckets(),
        diff.truncated());

    List<ChangeDetectionItemEntity> items = buildItems(run, analysis);
    if (items.isEmpty()) {
      run.setStatus(ChangeDetectionRunStatus.EMPTY);
      runRepository.save(run);
      return;
    }
    itemRepository.saveAll(items);
    run.setStatus(ChangeDetectionRunStatus.READY);
    runRepository.save(run);
  }

  private List<ChangeDetectionItemEntity> buildItems(
      ChangeDetectionRunEntity run, DiffHeuristicAnalyzer.Analysis analysis) {
    List<ChangeDetectionItemEntity> items = new ArrayList<>();
    if (analysis.buckets().contains(DiffHeuristicAnalyzer.FLOW_SIGNAL)) {
      items.add(
          item(
              run,
              ChangeDetectionItemKind.CONNECTION,
              0.55,
              "Integration / flow signals detected in diff. Accept to re-run connection suggestion on this application.",
              evidenceForBucket(analysis, DiffHeuristicAnalyzer.FLOW_SIGNAL),
              Map.of("action", "SUGGEST_CONNECTIONS", "repoFullName", run.getRepoFullName())));
    }
    if (analysis.buckets().contains(DiffHeuristicAnalyzer.MODULE_SIGNAL)) {
      items.add(
          item(
              run,
              ChangeDetectionItemKind.MODULE,
              0.55,
              "Module / package structure signals detected in diff. Accept to run module suggestion (fails if modules already exist).",
              evidenceForBucket(analysis, DiffHeuristicAnalyzer.MODULE_SIGNAL),
              Map.of("action", "SUGGEST_MODULES", "repoFullName", run.getRepoFullName())));
    }
    for (DiffHeuristicAnalyzer.AttributeHit hit : analysis.attributeHits()) {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("action", "PATCH_ATTRIBUTE");
      payload.put("target", hit.target());
      payload.put("key", hit.key());
      payload.put("value", hit.value());
      items.add(
          item(
              run,
              "EDGE".equals(hit.target())
                  ? ChangeDetectionItemKind.EDGE_ATTRIBUTE
                  : ChangeDetectionItemKind.NODE_ATTRIBUTE,
              0.65,
              "Data Model "
                  + hit.target()
                  + " key '"
                  + hit.key()
                  + "' appears set to '"
                  + hit.value()
                  + "' in "
                  + hit.path(),
              List.of(evidence(hit.path(), hit.preview())),
              payload));
    }
    return items;
  }

  private static ChangeDetectionItemEntity item(
      ChangeDetectionRunEntity run,
      ChangeDetectionItemKind kind,
      double confidence,
      String summary,
      List<Map<String, Object>> evidence,
      Map<String, Object> payload) {
    ChangeDetectionItemEntity entity = new ChangeDetectionItemEntity();
    entity.setRun(run);
    entity.setKind(kind);
    entity.setStatus(ChangeDetectionItemStatus.PENDING);
    entity.setConfidence(confidence);
    entity.setSummary(summary);
    entity.setEvidence(evidence);
    entity.setPayload(payload);
    return entity;
  }

  private static List<Map<String, Object>> evidenceForBucket(
      DiffHeuristicAnalyzer.Analysis analysis, String bucket) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> file : analysis.files()) {
      if (bucket.equals(String.valueOf(file.get("bucket")))) {
        out.add(evidence(String.valueOf(file.get("path")), null));
      }
    }
    return out;
  }

  private static Map<String, Object> evidence(String path, String hunkPreview) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("path", path);
    if (hunkPreview != null && !hunkPreview.isBlank()) {
      row.put("hunkPreview", hunkPreview);
    }
    return row;
  }

  @Transactional(readOnly = true)
  public List<ChangeDetectionRunDto> list(String applicationId, String status) {
    List<ChangeDetectionRunEntity> runs;
    if (StringUtils.hasText(applicationId)) {
      runs = runRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId.trim());
    } else if (StringUtils.hasText(status)) {
      runs =
          runRepository.findByStatusOrderByCreatedAtDesc(
              ChangeDetectionRunStatus.valueOf(status.trim().toUpperCase(Locale.ROOT)));
    } else {
      runs = runRepository.findByOrderByCreatedAtDesc();
    }
    return runs.stream().map(r -> toDto(r, itemRepository.findByRun_IdOrderByCreatedAtAsc(r.getId()))).toList();
  }

  @Transactional(readOnly = true)
  public ChangeDetectionRunDto get(UUID id) {
    ChangeDetectionRunEntity run =
        runRepository
            .findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Run not found."));
    return toDto(run, itemRepository.findByRun_IdOrderByCreatedAtAsc(id));
  }

  @Transactional
  public ChangeDetectionItemDto acceptItem(UUID runId, UUID itemId) {
    ChangeDetectionItemEntity item =
        itemRepository
            .findByIdAndRun_Id(itemId, runId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found."));
    if (item.getStatus() != ChangeDetectionItemStatus.PENDING) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Item is not PENDING.");
    }
    ChangeDetectionRunEntity run = item.getRun();
    if (!StringUtils.hasText(run.getApplicationId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Run has no linked application.");
    }
    applyAccept(run, item);
    item.setStatus(ChangeDetectionItemStatus.ACCEPTED);
    return toItemDto(itemRepository.save(item));
  }

  @Transactional
  public ChangeDetectionItemDto rejectItem(UUID runId, UUID itemId) {
    ChangeDetectionItemEntity item =
        itemRepository
            .findByIdAndRun_Id(itemId, runId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found."));
    if (item.getStatus() != ChangeDetectionItemStatus.PENDING) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Item is not PENDING.");
    }
    item.setStatus(ChangeDetectionItemStatus.REJECTED);
    return toItemDto(itemRepository.save(item));
  }

  private void applyAccept(ChangeDetectionRunEntity run, ChangeDetectionItemEntity item) {
    String appId = run.getApplicationId();
    Map<String, Object> payload = item.getPayload() != null ? item.getPayload() : Map.of();
    String repo = run.getRepoFullName();
    switch (item.getKind()) {
      case CONNECTION ->
          connectionSuggestionService.suggestFromGithub(
              appId, new SuggestConnectionsFromGithubRequest(repo));
      case MODULE ->
          moduleSuggestionService.suggestFromGithub(
              appId, new SuggestModulesFromGithubRequest(repo));
      case NODE_ATTRIBUTE -> {
        String key = String.valueOf(payload.get("key"));
        String value = String.valueOf(payload.get("value"));
        if (StringUtils.hasText(key) && StringUtils.hasText(value)) {
          nodeAttributePatchService.patch(appId, Map.of(key, value));
        }
      }
      case EDGE_ATTRIBUTE -> {
        // Edge attribute patches need a concrete DEPENDS_ON id; v1 records accept as
        // acknowledgement that ops should re-run connection suggestion / manual edit.
        log.info(
            "EDGE_ATTRIBUTE accept acknowledged (no auto edge write) app={} key={} value={}",
            appId,
            payload.get("key"),
            payload.get("value"));
      }
      default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown item kind.");
    }
  }

  private static ChangeDetectionRunDto toDto(
      ChangeDetectionRunEntity run, List<ChangeDetectionItemEntity> items) {
    return new ChangeDetectionRunDto(
        run.getId(),
        run.getProvider(),
        run.getRepoFullName(),
        run.getCommitSha(),
        run.getBranchRef(),
        run.getApplicationId(),
        run.getStatus().name(),
        run.isTruncated(),
        List.copyOf(run.getBuckets()),
        List.copyOf(run.getFiles()),
        run.getErrorMessage(),
        items.stream().map(ChangeDetectionService::toItemDto).toList(),
        run.getCreatedAt(),
        run.getUpdatedAt());
  }

  private static ChangeDetectionItemDto toItemDto(ChangeDetectionItemEntity item) {
    return new ChangeDetectionItemDto(
        item.getId(),
        item.getKind().name(),
        item.getStatus().name(),
        item.getConfidence(),
        item.getSummary(),
        List.copyOf(item.getEvidence()),
        Map.copyOf(item.getPayload()),
        item.getCreatedAt(),
        item.getUpdatedAt());
  }

  private static String text(JsonNode node, String field) {
    if (node == null || node.isMissingNode() || node.isNull()) {
      return "";
    }
    JsonNode v = node.get(field);
    return v == null || v.isNull() ? "" : v.asText("");
  }

  private static String shortSha(String sha) {
    return sha != null && sha.length() > 7 ? sha.substring(0, 7) : sha;
  }
}
