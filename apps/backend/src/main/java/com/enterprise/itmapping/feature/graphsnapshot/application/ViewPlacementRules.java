package com.enterprise.itmapping.feature.graphsnapshot.application;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Where a saved view or a view folder may sit. Depth is counted from the root, which is 1. */
public final class ViewPlacementRules {

  public static final int MAX_FOLDER_DEPTH = 8;

  private ViewPlacementRules() {}

  public record FolderNode(UUID id, UUID parentId, String name) {}

  public record ViewName(UUID id, UUID folderId, String name) {}

  public static int depth(List<FolderNode> folders, UUID folderId) {
    Map<UUID, UUID> parentById = parentById(folders);
    int depth = 0;
    UUID current = folderId;
    Set<UUID> seen = new HashSet<>();
    while (current != null && seen.add(current)) {
      depth++;
      current = parentById.get(current);
    }
    return depth;
  }

  public static boolean canCreateIn(List<FolderNode> folders, UUID parentId) {
    if (parentId == null) return true;
    return depth(folders, parentId) < MAX_FOLDER_DEPTH;
  }

  public static boolean canMoveFolder(List<FolderNode> folders, UUID folderId, UUID newParentId) {
    if (folderId.equals(newParentId)) return false;
    if (newParentId != null && isUnder(folders, newParentId, folderId)) return false;
    int newDepth = newParentId == null ? 1 : depth(folders, newParentId) + 1;
    return newDepth + subtreeHeight(folders, folderId) <= MAX_FOLDER_DEPTH;
  }

  public static boolean nameTaken(
      List<FolderNode> folders,
      List<ViewName> views,
      UUID parentId,
      String name,
      UUID ignoreFolderId,
      UUID ignoreViewId) {
    String needle = name.trim().toLowerCase(Locale.ROOT);
    for (FolderNode folder : folders) {
      if (folder.id().equals(ignoreFolderId) || !samePlace(folder.parentId(), parentId)) continue;
      if (folder.name().trim().toLowerCase(Locale.ROOT).equals(needle)) return true;
    }
    for (ViewName view : views) {
      if (view.id().equals(ignoreViewId) || !samePlace(view.folderId(), parentId)) continue;
      if (view.name().trim().toLowerCase(Locale.ROOT).equals(needle)) return true;
    }
    return false;
  }

  private static boolean isUnder(List<FolderNode> folders, UUID nodeId, UUID ancestorId) {
    Map<UUID, UUID> parentById = parentById(folders);
    UUID current = nodeId;
    Set<UUID> seen = new HashSet<>();
    while (current != null && seen.add(current)) {
      if (current.equals(ancestorId)) return true;
      current = parentById.get(current);
    }
    return false;
  }

  private static int subtreeHeight(List<FolderNode> folders, UUID folderId) {
    Map<UUID, List<UUID>> children = new HashMap<>();
    for (FolderNode folder : folders) {
      if (folder.parentId() == null) continue;
      children.computeIfAbsent(folder.parentId(), ignored -> new ArrayList<>()).add(folder.id());
    }
    return height(children, folderId);
  }

  private static int height(Map<UUID, List<UUID>> children, UUID id) {
    int max = 0;
    for (UUID child : children.getOrDefault(id, List.of())) {
      max = Math.max(max, 1 + height(children, child));
    }
    return max;
  }

  private static boolean samePlace(UUID left, UUID right) {
    if (left == null || right == null) return left == null && right == null;
    return left.equals(right);
  }

  private static Map<UUID, UUID> parentById(List<FolderNode> folders) {
    Map<UUID, UUID> parentById = new HashMap<>();
    for (FolderNode folder : folders) {
      parentById.put(folder.id(), folder.parentId());
    }
    return parentById;
  }
}
