package com.enterprise.itmapping.feature.graphsnapshot.application;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotRepository;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.CreateGraphSnapshotRequest;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphSnapshotFiltersDto;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphSnapshotResponse;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.NodePositionDto;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GraphSnapshotService {

  private final GraphSnapshotRepository graphSnapshotRepository;
  private final CurrentUserResolver currentUserResolver;

  public GraphSnapshotService(
      GraphSnapshotRepository graphSnapshotRepository, CurrentUserResolver currentUserResolver) {
    this.graphSnapshotRepository = graphSnapshotRepository;
    this.currentUserResolver = currentUserResolver;
  }

  @Transactional(readOnly = true)
  public List<GraphSnapshotResponse> listForCurrentUser() {
    UserEntity user = currentUserResolver.requireCurrentUser();
    return graphSnapshotRepository.findByUser_IdOrderByCreatedAtDesc(user.getId()).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public GraphSnapshotResponse create(CreateGraphSnapshotRequest request) {
    UserEntity user = currentUserResolver.requireCurrentUser();
    String name = normalizeName(request.name());
    if (graphSnapshotRepository.existsByUser_IdAndNameIgnoreCase(user.getId(), name)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Une vue avec ce nom existe déjà.");
    }

    GraphSnapshotFiltersDto filters = normalizeFilters(request.filters());
    GraphSnapshotEntity entity = new GraphSnapshotEntity();
    entity.setUser(user);
    entity.setName(name);
    entity.setApplicationIds(filters.applicationIds());
    entity.setNodeAttributes(new LinkedHashMap<>(filters.nodeAttributes()));
    entity.setNodeRefs(new LinkedHashMap<>(filters.nodeRefs()));
    entity.setHiddenApplicationIds(filters.hiddenApplicationIds());
    entity.setNodePositions(new LinkedHashMap<>(filters.nodePositions()));
    entity.setLegend(filters.legend());

    return toResponse(graphSnapshotRepository.save(entity));
  }

  @Transactional
  public void deleteForCurrentUser(UUID id) {
    UserEntity user = currentUserResolver.requireCurrentUser();
    GraphSnapshotEntity entity =
        graphSnapshotRepository
            .findByIdAndUser_Id(id, user.getId())
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vue introuvable."));
    graphSnapshotRepository.delete(entity);
  }

  private static String normalizeName(String raw) {
    if (!StringUtils.hasText(raw)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom est obligatoire.");
    }
    String trimmed = raw.trim();
    if (trimmed.length() > 80) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom ne peut pas dépasser 80 caractères.");
    }
    return trimmed;
  }

  private static GraphSnapshotFiltersDto normalizeFilters(GraphSnapshotFiltersDto filters) {
    if (filters == null) {
      return new GraphSnapshotFiltersDto(List.of(), Map.of(), Map.of(), List.of(), Map.of(), null);
    }
    return new GraphSnapshotFiltersDto(
        normalizeIdList(filters.applicationIds()),
        normalizeKeyedLists(filters.nodeAttributes()),
        normalizeKeyedLists(filters.nodeRefs()),
        normalizeIdList(filters.hiddenApplicationIds()),
        normalizeNodePositions(filters.nodePositions()),
        filters.legend());
  }

  /** Drops blank keys/values and keys left without any value; Data Model keys are lower-case. */
  private static Map<String, List<String>> normalizeKeyedLists(Map<String, List<String>> raw) {
    if (raw == null || raw.isEmpty()) {
      return Map.of();
    }
    Map<String, List<String>> out = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> entry : raw.entrySet()) {
      if (!StringUtils.hasText(entry.getKey())) {
        continue;
      }
      List<String> values = normalizeIdList(entry.getValue());
      if (!values.isEmpty()) {
        out.put(entry.getKey().trim().toLowerCase(Locale.ROOT), values);
      }
    }
    return Map.copyOf(out);
  }

  private static List<String> normalizeIdList(List<String> values) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    List<String> out = new ArrayList<>();
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        out.add(value.trim());
      }
    }
    return List.copyOf(out);
  }

  private static Map<String, List<String>> copyKeyedLists(Map<String, List<String>> raw) {
    if (raw == null || raw.isEmpty()) {
      return Map.of();
    }
    Map<String, List<String>> out = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> entry : raw.entrySet()) {
      out.put(entry.getKey(), List.copyOf(entry.getValue()));
    }
    return Map.copyOf(out);
  }

  private static Map<String, NodePositionDto> normalizeNodePositions(
      Map<String, NodePositionDto> values) {
    if (values == null || values.isEmpty()) {
      return Map.of();
    }
    Map<String, NodePositionDto> out = new LinkedHashMap<>();
    for (Map.Entry<String, NodePositionDto> entry : values.entrySet()) {
      if (!StringUtils.hasText(entry.getKey()) || entry.getValue() == null) {
        continue;
      }
      out.put(entry.getKey().trim(), entry.getValue());
    }
    return Map.copyOf(out);
  }

  private GraphSnapshotResponse toResponse(GraphSnapshotEntity entity) {
    return new GraphSnapshotResponse(
        entity.getId(),
        entity.getName(),
        new GraphSnapshotFiltersDto(
            List.copyOf(entity.getApplicationIds()),
            copyKeyedLists(entity.getNodeAttributes()),
            copyKeyedLists(entity.getNodeRefs()),
            List.copyOf(entity.getHiddenApplicationIds()),
            Map.copyOf(entity.getNodePositions()),
            entity.getLegend()),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }
}
