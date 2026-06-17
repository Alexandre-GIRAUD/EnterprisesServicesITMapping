package com.enterprise.itmapping.feature.graphsnapshot.application;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotRepository;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.CreateGraphSnapshotRequest;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphSnapshotFiltersDto;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphSnapshotResponse;
import java.util.ArrayList;
import java.util.List;
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
    entity.setYear(filters.year());
    entity.setApplicationIds(filters.applicationIds());
    entity.setBusinessUnitIds(filters.businessUnitIds());
    entity.setRegionCodes(filters.regionCodes());

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
    return new GraphSnapshotFiltersDto(
        filters.year(),
        normalizeIdList(filters.applicationIds()),
        normalizeIdList(filters.businessUnitIds()),
        normalizeIdList(filters.regionCodes()));
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

  private GraphSnapshotResponse toResponse(GraphSnapshotEntity entity) {
    return new GraphSnapshotResponse(
        entity.getId(),
        entity.getName(),
        new GraphSnapshotFiltersDto(
            entity.getYear(),
            List.copyOf(entity.getApplicationIds()),
            List.copyOf(entity.getBusinessUnitIds()),
            List.copyOf(entity.getRegionCodes())),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }
}
