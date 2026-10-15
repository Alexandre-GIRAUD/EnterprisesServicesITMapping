package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.AiDecisionSourceEntity;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.AiDecisionSourceRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** Persists the repository files that justified one AI finding. */
@Service
public class AiDecisionSourceService {

  public static final int MAX_SOURCE_FILES = 20;
  public static final String PIPELINE_CONNECTION = "CONNECTION_SUGGESTION";
  public static final String PIPELINE_MODULE = "MODULE_SUGGESTION";
  public static final String KIND_NODE = "NODE";
  public static final String KIND_EDGE = "EDGE";
  public static final String KIND_NODE_PROPERTY = "NODE_PROPERTY";
  public static final String KIND_EDGE_PROPERTY = "EDGE_PROPERTY";
  public static final String TARGET_APPLICATION = "APPLICATION";
  public static final String TARGET_MODULE = "MODULE";
  public static final String TARGET_EDGE = "EDGE";
  public static final String CONTAINS_TARGET_JOIN = ">";

  private final AiDecisionSourceRepository repository;

  public AiDecisionSourceService(AiDecisionSourceRepository repository) {
    this.repository = repository;
  }

  /**
   * Cited paths the tools actually read or grepped, in citation order, capped at {@link
   * #MAX_SOURCE_FILES}.
   */
  public static List<String> ground(List<String> cited, Collection<String> observed) {
    if (cited == null || cited.isEmpty() || observed == null || observed.isEmpty()) {
      return List.of();
    }
    Set<String> allowed = new LinkedHashSet<>();
    for (String raw : observed) {
      String normalized = normalizeRelativePath(raw);
      if (normalized != null) {
        allowed.add(normalized);
      }
    }
    List<String> kept = new ArrayList<>();
    for (String raw : cited) {
      String normalized = normalizeRelativePath(raw);
      if (normalized == null || !allowed.contains(normalized) || kept.contains(normalized)) {
        continue;
      }
      kept.add(normalized);
      if (kept.size() == MAX_SOURCE_FILES) {
        break;
      }
    }
    return List.copyOf(kept);
  }

  @Transactional
  public void record(Decision decision) {
    save(decision, ground(decision == null ? null : decision.citedFiles(), decision == null ? null : decision.observedFiles()));
  }

  /** Stores document excerpts as cited. They are sentences, not repository paths. */
  @Transactional
  public void recordQuoted(Decision decision) {
    save(decision, capQuotes(decision == null ? null : decision.citedFiles()));
  }

  private void save(Decision decision, List<String> files) {
    if (decision == null
        || !StringUtils.hasText(decision.targetId())
        || !StringUtils.hasText(decision.repositoryName())
        || files == null
        || files.isEmpty()) {
      return;
    }
    AiDecisionSourceEntity entity = new AiDecisionSourceEntity();
    entity.setPipeline(decision.pipeline());
    entity.setDecisionKind(decision.decisionKind());
    entity.setTargetType(decision.targetType());
    entity.setTargetId(decision.targetId().trim());
    entity.setFieldKey(StringUtils.hasText(decision.fieldKey()) ? decision.fieldKey().trim() : null);
    entity.setRepositoryName(decision.repositoryName().trim());
    entity.setSourceFiles(files);
    repository.save(entity);
  }

  private static List<String> capQuotes(List<String> cited) {
    if (cited == null || cited.isEmpty()) {
      return List.of();
    }
    List<String> kept = new ArrayList<>();
    for (String raw : cited) {
      if (raw == null) {
        continue;
      }
      String quote = raw.trim();
      if (quote.isEmpty() || kept.contains(quote)) {
        continue;
      }
      kept.add(quote);
      if (kept.size() == MAX_SOURCE_FILES) {
        break;
      }
    }
    return List.copyOf(kept);
  }

  @Transactional(readOnly = true)
  public List<Trace> list(String targetType, String targetId) {
    if (!StringUtils.hasText(targetType) || !StringUtils.hasText(targetId)) {
      return List.of();
    }
    return repository
        .findByTargetTypeAndTargetIdOrderByCreatedAtAsc(targetType, targetId.trim())
        .stream()
        .map(
            row ->
                new Trace(
                    row.getDecisionKind(),
                    row.getFieldKey(),
                    row.getRepositoryName(),
                    row.getSourceFiles()))
        .toList();
  }

  public static String containsTargetId(String parentId, String childId) {
    return parentId + CONTAINS_TARGET_JOIN + childId;
  }

  static String normalizeRelativePath(String raw) {
    if (raw == null) {
      return null;
    }
    String path = raw.trim().replace('\\', '/');
    while (path.startsWith("./")) {
      path = path.substring(2);
    }
    if (path.isEmpty() || path.startsWith("/")) {
      return null;
    }
    for (String segment : path.split("/")) {
      if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) {
        return null;
      }
    }
    return path;
  }

  public record Decision(
      String pipeline,
      String decisionKind,
      String targetType,
      String targetId,
      String fieldKey,
      String repositoryName,
      List<String> citedFiles,
      Collection<String> observedFiles) {}

  public record Trace(
      String decisionKind, String fieldKey, String repositoryName, List<String> sourceFiles) {}
}
