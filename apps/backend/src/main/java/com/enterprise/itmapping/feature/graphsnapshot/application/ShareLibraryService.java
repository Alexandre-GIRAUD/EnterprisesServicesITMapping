package com.enterprise.itmapping.feature.graphsnapshot.application;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.graphsnapshot.application.ViewPlacementRules.FolderNode;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotRepository;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphViewFolderEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphViewFolderRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ShareLibraryService {

  private final UserRepository userRepository;
  private final GraphSnapshotRepository graphSnapshotRepository;
  private final GraphViewFolderRepository graphViewFolderRepository;
  private final CurrentUserResolver currentUserResolver;

  public ShareLibraryService(
      UserRepository userRepository,
      GraphSnapshotRepository graphSnapshotRepository,
      GraphViewFolderRepository graphViewFolderRepository,
      CurrentUserResolver currentUserResolver) {
    this.userRepository = userRepository;
    this.graphSnapshotRepository = graphSnapshotRepository;
    this.graphViewFolderRepository = graphViewFolderRepository;
    this.currentUserResolver = currentUserResolver;
  }

  @Transactional
  public void shareView(UUID viewId, String rawUsername) {
    UserEntity sender = currentUserResolver.requireCurrentUser();
    UserEntity recipient = requireRecipient(sender, rawUsername);
    GraphSnapshotEntity source =
        graphSnapshotRepository
            .findByIdAndUser_Id(viewId, sender.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vue introuvable."));
    String name = ShareCopyNames.choose(source.getName(), sender.getUsername(), (candidate) -> rootNameTaken(recipient.getId(), candidate));
    GraphSnapshotEntity copy = detachedCopy(source);
    copy.setUser(recipient);
    copy.setFolderId(null);
    copy.setName(name);
    graphSnapshotRepository.save(copy);
  }

  @Transactional
  public void shareFolder(UUID folderId, String rawUsername) {
    UserEntity sender = currentUserResolver.requireCurrentUser();
    UserEntity recipient = requireRecipient(sender, rawUsername);
    graphViewFolderRepository
        .findByIdAndUser_Id(folderId, sender.getId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dossier introuvable."));

    List<GraphViewFolderEntity> owned = graphViewFolderRepository.findByUser_IdOrderByNameAsc(sender.getId());
    List<FolderNode> nodes = owned.stream().map(folder -> new FolderNode(folder.getId(), folder.getParentId(), folder.getName())).toList();
    List<GraphViewFolderEntity> subtree = subtreeOf(owned, folderId);
    subtree.sort(Comparator.comparingInt(folder -> ViewPlacementRules.depth(nodes, folder.getId())));

    Map<UUID, UUID> copiedIds = new LinkedHashMap<>();
    for (GraphViewFolderEntity source : subtree) {
      GraphViewFolderEntity copy = new GraphViewFolderEntity();
      copy.setId(UUID.randomUUID());
      copy.setUser(recipient);
      if (source.getId().equals(folderId)) {
        copy.setParentId(null);
        copy.setName(ShareCopyNames.choose(source.getName(), sender.getUsername(), (candidate) -> rootNameTaken(recipient.getId(), candidate)));
      } else {
        copy.setParentId(copiedIds.get(source.getParentId()));
        copy.setName(source.getName());
      }
      graphViewFolderRepository.save(copy);
      copiedIds.put(source.getId(), copy.getId());
    }

    for (GraphSnapshotEntity source : graphSnapshotRepository.findByUser_IdOrderByCreatedAtDesc(sender.getId())) {
      UUID copiedFolderId = copiedIds.get(source.getFolderId());
      if (copiedFolderId == null) continue;
      GraphSnapshotEntity copy = detachedCopy(source);
      copy.setUser(recipient);
      copy.setFolderId(copiedFolderId);
      copy.setName(source.getName());
      graphSnapshotRepository.save(copy);
    }
  }

  private UserEntity requireRecipient(UserEntity sender, String rawUsername) {
    if (!StringUtils.hasText(rawUsername)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom d'utilisateur est obligatoire.");
    }
    UserEntity recipient =
        userRepository
            .findByUsernameIgnoreCase(rawUsername.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable."));
    if (recipient.getId().equals(sender.getId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous ne pouvez pas partager avec vous-même.");
    }
    return recipient;
  }

  private boolean rootNameTaken(UUID userId, String name) {
    return graphSnapshotRepository.existsSiblingName(userId, null, name, null)
        || graphViewFolderRepository.existsSiblingName(userId, null, name, null);
  }

  private static List<GraphViewFolderEntity> subtreeOf(List<GraphViewFolderEntity> owned, UUID rootId) {
    Set<UUID> inside = new HashSet<>();
    inside.add(rootId);
    boolean grew = true;
    while (grew) {
      grew = false;
      for (GraphViewFolderEntity folder : owned) {
        if (folder.getParentId() != null && inside.contains(folder.getParentId()) && inside.add(folder.getId())) {
          grew = true;
        }
      }
    }
    List<GraphViewFolderEntity> subtree = new ArrayList<>();
    for (GraphViewFolderEntity folder : owned) {
      if (inside.contains(folder.getId())) subtree.add(folder);
    }
    return subtree;
  }

  private static GraphSnapshotEntity detachedCopy(GraphSnapshotEntity source) {
    GraphSnapshotEntity copy = new GraphSnapshotEntity();
    copy.setApplicationIds(source.getApplicationIds() == null ? List.of() : new ArrayList<>(source.getApplicationIds()));
    copy.setNodeAttributes(copyKeyed(source.getNodeAttributes()));
    copy.setNodeRefs(copyKeyed(source.getNodeRefs()));
    copy.setEdgeAttributes(copyKeyed(source.getEdgeAttributes()));
    copy.setHiddenApplicationIds(
        source.getHiddenApplicationIds() == null ? List.of() : new ArrayList<>(source.getHiddenApplicationIds()));
    copy.setNodePositions(source.getNodePositions() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(source.getNodePositions()));
    copy.setLegend(source.getLegend());
    return copy;
  }

  private static Map<String, List<String>> copyKeyed(Map<String, List<String>> raw) {
    if (raw == null || raw.isEmpty()) return new LinkedHashMap<>();
    Map<String, List<String>> out = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> entry : raw.entrySet()) {
      out.put(entry.getKey(), entry.getValue() == null ? List.of() : List.copyOf(entry.getValue()));
    }
    return out;
  }
}
