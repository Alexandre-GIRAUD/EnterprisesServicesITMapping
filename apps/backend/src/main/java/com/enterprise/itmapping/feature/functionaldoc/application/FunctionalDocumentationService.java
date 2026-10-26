package com.enterprise.itmapping.feature.functionaldoc.application;

import com.enterprise.itmapping.feature.applications.application.GithubRepoIdentityResolver;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.functionaldoc.application.FunctionalDocumentationAgent.DiscoveryResult;
import com.enterprise.itmapping.feature.functionaldoc.domain.FunctionalDocStatus;
import com.enterprise.itmapping.feature.functionaldoc.infrastructure.persistence.ApplicationFunctionalDocEntity;
import com.enterprise.itmapping.feature.functionaldoc.infrastructure.persistence.ApplicationFunctionalDocRepository;
import com.enterprise.itmapping.feature.functionaldoc.presentation.dto.FunctionalDocumentationResponse;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubRepoCloneService;
import com.enterprise.itmapping.feature.integrations.llm.FunctionalDocumentationProperties;
import com.enterprise.itmapping.feature.rag.application.FunctionalDocIndexer;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Loads and asynchronously generates functional documentation for GitHub-linked applications.
 */
@Service
public class FunctionalDocumentationService {

  private static final Logger log = LoggerFactory.getLogger(FunctionalDocumentationService.class);

  private final ApplicationRepository applicationRepository;
  private final ApplicationFunctionalDocRepository docRepository;
  private final GitHubRepoCloneService cloneService;
  private final FunctionalDocumentationAgent agent;
  private final FunctionalDocumentationProperties properties;
  private final ObjectProvider<FunctionalDocumentationService> self;
  private final ObjectProvider<FunctionalDocIndexer> indexer;

  public FunctionalDocumentationService(
      ApplicationRepository applicationRepository,
      ApplicationFunctionalDocRepository docRepository,
      GitHubRepoCloneService cloneService,
      FunctionalDocumentationAgent agent,
      FunctionalDocumentationProperties properties,
      ObjectProvider<FunctionalDocumentationService> self,
      ObjectProvider<FunctionalDocIndexer> indexer) {
    this.applicationRepository = applicationRepository;
    this.docRepository = docRepository;
    this.cloneService = cloneService;
    this.agent = agent;
    this.properties = properties;
    this.self = self;
    this.indexer = indexer;
  }

  @Transactional(readOnly = true)
  public FunctionalDocumentationResponse get(String applicationId) {
    requireApplication(applicationId);
    return docRepository
        .findByApplicationId(applicationId)
        .map(this::toResponse)
        .orElseGet(() -> missingResponse(applicationId));
  }

  /**
   * Marks the doc as {@code PENDING} then starts async generation after the write commits.
   * Returns immediately (caller should respond 202).
   */
  public FunctionalDocumentationResponse startGenerate(String applicationId) {
    // Commit PENDING first — otherwise @Async can run before the insert is visible.
    String accessToken = cloneService.currentAccessToken();
    FunctionalDocumentationResponse pending = self.getObject().markPending(applicationId);
    self.getObject().generateAsync(applicationId, accessToken);
    return pending;
  }

  @Transactional
  public FunctionalDocumentationResponse markPending(String applicationId) {
    var app =
        applicationRepository
            .findProjectionById(applicationId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Application not found: " + applicationId));

    List<String> fullNames =
        GithubRepoIdentityResolver.resolveAllFullNames(app.getName(), app.getDescription());
    if (fullNames.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "GitHub repository not found for this application: set name=owner/repo or a"
              + " GitHub description URL.");
    }
    String sourceRepos = String.join("\n", fullNames);
    if (sourceRepos.length() > 255) {
      sourceRepos = sourceRepos.substring(0, 255);
    }

    ApplicationFunctionalDocEntity entity =
        docRepository.findByApplicationId(applicationId).orElseGet(ApplicationFunctionalDocEntity::new);

    if (entity.getStatus() == FunctionalDocStatus.PENDING && entity.getId() != null) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Functional documentation generation is already in progress.");
    }

    entity.setApplicationId(applicationId);
    entity.setStatus(FunctionalDocStatus.PENDING);
    entity.setLocale(properties.locale());
    entity.setSourceRepo(sourceRepos);
    entity.setPayload(null);
    entity.setMarkdownCache(null);
    entity.setAnalyzedFiles(List.of());
    entity.setErrorMessage(null);
    entity.setGeneratedAt(null);
    docRepository.save(entity);
    clearRagIndex(applicationId);
    return toResponse(entity);
  }

  @Async
  public void generateAsync(String applicationId, String accessToken) {
    try {
      self.getObject().runGeneration(applicationId, accessToken);
    } catch (Exception e) {
      log.error("Functional documentation generation failed applicationId={}", applicationId, e);
      self.getObject()
          .markFailed(
              applicationId, e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
    }
  }

  @Transactional
  public void runGeneration(String applicationId, String accessToken) {
    ApplicationFunctionalDocEntity entity =
        docRepository
            .findByApplicationId(applicationId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Functional documentation row missing."));

    var app =
        applicationRepository
            .findProjectionById(applicationId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Application not found: " + applicationId));

    List<String> fullNames =
        GithubRepoIdentityResolver.resolveAllFullNames(app.getName(), app.getDescription());
    if (fullNames.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "GitHub repository not found for this application.");
    }
    String sourceRepos = String.join("\n", fullNames);
    if (sourceRepos.length() > 255) {
      sourceRepos = sourceRepos.substring(0, 255);
    }

    log.info("Functional documentation generate start applicationId={} repos={}", applicationId, fullNames);

    Path workspace = cloneService.cloneAll(fullNames, properties.cloneTimeoutSeconds(), accessToken);
    try {
      DiscoveryResult discovery = agent.discoverAll(workspace, fullNames);
      entity.setStatus(FunctionalDocStatus.READY);
      entity.setLocale(properties.locale());
      entity.setPayload(discovery.payload());
      entity.setSourceRepo(sourceRepos);
      entity.setAnalyzedFiles(discovery.analyzedFiles());
      entity.setErrorMessage(null);
      entity.setGeneratedAt(Instant.now());
      docRepository.save(entity);
      log.info("Functional documentation generate done applicationId={}", applicationId);
      reindexRag(applicationId);
    } finally {
      cloneService.deleteQuietly(workspace);
    }
  }

  @Transactional
  public void markFailed(String applicationId, String message) {
    docRepository
        .findByApplicationId(applicationId)
        .ifPresent(
            entity -> {
              entity.setStatus(FunctionalDocStatus.FAILED);
              entity.setErrorMessage(truncate(message, 2000));
              entity.setPayload(null);
              docRepository.save(entity);
              clearRagIndex(applicationId);
            });
  }

  private void reindexRag(String applicationId) {
    try {
      FunctionalDocIndexer rag = indexer.getIfAvailable();
      if (rag != null) {
        rag.reindex(applicationId);
      }
    } catch (Exception e) {
      log.warn(
          "RAG reindex failed after READY (doc kept) applicationId={}: {}",
          applicationId,
          e.getMessage());
    }
  }

  private void clearRagIndex(String applicationId) {
    try {
      FunctionalDocIndexer rag = indexer.getIfAvailable();
      if (rag != null) {
        rag.deleteByApplicationId(applicationId);
      }
    } catch (Exception e) {
      log.warn("RAG index clear failed applicationId={}: {}", applicationId, e.getMessage());
    }
  }

  private void requireApplication(String applicationId) {
    if (applicationRepository.findProjectionById(applicationId).isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Application not found: " + applicationId);
    }
  }

  private FunctionalDocumentationResponse toResponse(ApplicationFunctionalDocEntity entity) {
    return new FunctionalDocumentationResponse(
        entity.getApplicationId(),
        entity.getStatus(),
        entity.getLocale(),
        entity.getPayload(),
        entity.getSourceRepo(),
        entity.getAnalyzedFiles(),
        entity.getGeneratedAt(),
        entity.getErrorMessage());
  }

  private FunctionalDocumentationResponse missingResponse(String applicationId) {
    return new FunctionalDocumentationResponse(
        applicationId,
        FunctionalDocStatus.MISSING,
        properties.locale(),
        null,
        null,
        List.of(),
        null,
        null);
  }

  private static String truncate(String s, int max) {
    if (s == null) {
      return null;
    }
    return s.length() <= max ? s : s.substring(0, max);
  }
}
