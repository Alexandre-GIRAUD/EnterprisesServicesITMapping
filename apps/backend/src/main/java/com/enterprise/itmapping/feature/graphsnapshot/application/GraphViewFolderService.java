package com.enterprise.itmapping.feature.graphsnapshot.application;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.graphsnapshot.application.ViewPlacementRules.FolderNode;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotRepository;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphViewFolderEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphViewFolderRepository;
import com.enterprise.itmapping.feature.graphsnapshot.presentation.dto.GraphViewFolderResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GraphViewFolderService {

  private final GraphViewFolderRepository graphViewFolderRepository;
  private final GraphSnapshotRepository graphSnapshotRepository;
  private final CurrentUserResolver currentUserResolver;

  public GraphViewFolderService(
      GraphViewFolderRepository graphViewFolderRepository,
      GraphSnapshotRepository graphSnapshotRepository,
      CurrentUserResolver currentUserResolver) {
    this.graphViewFolderRepository = graphViewFolderRepository;
    this.graphSnapshotRepository = graphSnapshotRepository;
    this.currentUserResolver = currentUserResolver;
  }

  @Transactional(readOnly = true)
  public List<GraphViewFolderResponse> listForCurrentUser() {
    UserEntity user = currentUserResolver.requireCurrentUser();
    return graphViewFolderRepository.findByUser_IdOrderByNameAsc(user.getId()).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public GraphViewFolderResponse create(String rawName, UUID parentId) {
    UserEntity user = currentUserResolver.requireCurrentUser();
    String name = normalizeName(rawName);
    requireParent(user.getId(), parentId);
    if (!ViewPlacementRules.canCreateIn(folderNodes(user.getId()), parentId)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Un dossier ne peut pas dépasser 8 niveaux.");
    }
    rejectSiblingClash(user.getId(), parentId, name, null);
    GraphViewFolderEntity entity = new GraphViewFolderEntity();
    entity.setUser(user);
    entity.setParentId(parentId);
    entity.setName(name);
    return toResponse(graphViewFolderRepository.save(entity));
  }

  @Transactional
  public GraphViewFolderResponse rename(UUID id, String rawName) {
    UserEntity user = currentUserResolver.requireCurrentUser();
    String name = normalizeName(rawName);
    GraphViewFolderEntity entity = requireFolder(user.getId(), id);
    rejectSiblingClash(user.getId(), entity.getParentId(), name, id);
    entity.setName(name);
    return toResponse(graphViewFolderRepository.save(entity));
  }

  @Transactional
  public GraphViewFolderResponse move(UUID id, UUID parentId) {
    UserEntity user = currentUserResolver.requireCurrentUser();
    GraphViewFolderEntity entity = requireFolder(user.getId(), id);
    requireParent(user.getId(), parentId);
    if (!ViewPlacementRules.canMoveFolder(folderNodes(user.getId()), id, parentId)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Ce dossier ne peut pas être déplacé ici.");
    }
    rejectSiblingClash(user.getId(), parentId, entity.getName(), id);
    entity.setParentId(parentId);
    return toResponse(graphViewFolderRepository.save(entity));
  }

  @Transactional
  public void delete(UUID id) {
    UserEntity user = currentUserResolver.requireCurrentUser();
    graphViewFolderRepository.delete(requireFolder(user.getId(), id));
  }

  private void requireParent(UUID userId, UUID parentId) {
    if (parentId == null) return;
    requireFolder(userId, parentId);
  }

  private GraphViewFolderEntity requireFolder(UUID userId, UUID id) {
    return graphViewFolderRepository
        .findByIdAndUser_Id(id, userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dossier introuvable."));
  }

  private void rejectSiblingClash(UUID userId, UUID parentId, String name, UUID ignoreFolderId) {
    if (graphViewFolderRepository.existsSiblingName(userId, parentId, name, ignoreFolderId)
        || graphSnapshotRepository.existsSiblingName(userId, parentId, name, null)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Un élément avec ce nom existe déjà.");
    }
  }

  private List<FolderNode> folderNodes(UUID userId) {
    return graphViewFolderRepository.findByUser_IdOrderByNameAsc(userId).stream()
        .map(folder -> new FolderNode(folder.getId(), folder.getParentId(), folder.getName()))
        .toList();
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

  private GraphViewFolderResponse toResponse(GraphViewFolderEntity entity) {
    return new GraphViewFolderResponse(
        entity.getId(), entity.getName(), entity.getParentId(), entity.getCreatedAt(), entity.getUpdatedAt());
  }
}
