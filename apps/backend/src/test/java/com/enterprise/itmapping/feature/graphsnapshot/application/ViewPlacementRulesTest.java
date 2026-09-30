package com.enterprise.itmapping.feature.graphsnapshot.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.enterprise.itmapping.feature.graphsnapshot.application.ViewPlacementRules.FolderNode;
import com.enterprise.itmapping.feature.graphsnapshot.application.ViewPlacementRules.ViewName;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ViewPlacementRulesTest {

  @Test
  void namesAreUniqueAmongSiblingsOnly() {
    UUID parent = UUID.fromString("00000000-0000-0000-0000-000000000010");
    UUID other = UUID.fromString("00000000-0000-0000-0000-000000000011");
    UUID folderId = UUID.fromString("00000000-0000-0000-0000-000000000012");
    UUID viewId = UUID.fromString("00000000-0000-0000-0000-000000000013");
    List<FolderNode> folders =
        List.of(new FolderNode(folderId, parent, "Payments"));
    List<ViewName> views = List.of(new ViewName(viewId, other, "Payments"));

    assertTrue(ViewPlacementRules.nameTaken(folders, views, parent, "payments", null, null));
    assertFalse(ViewPlacementRules.nameTaken(folders, views, other, "payments", null, viewId));
    assertFalse(ViewPlacementRules.nameTaken(folders, views, null, "Payments", null, null));
  }

  @Test
  void folderCannotMoveIntoItselfOrADescendant() {
    UUID root = UUID.fromString("00000000-0000-0000-0000-000000000001");
    UUID child = UUID.fromString("00000000-0000-0000-0000-000000000002");
    List<FolderNode> folders =
        List.of(new FolderNode(root, null, "A"), new FolderNode(child, root, "B"));

    assertFalse(ViewPlacementRules.canMoveFolder(folders, root, root));
    assertFalse(ViewPlacementRules.canMoveFolder(folders, root, child));
    assertTrue(ViewPlacementRules.canMoveFolder(folders, child, null));
  }

  @Test
  void nestingStopsAtEightLevels() {
    List<FolderNode> folders = new ArrayList<>();
    UUID parent = null;
    UUID deepest = null;
    for (int level = 1; level <= 8; level++) {
      UUID id = UUID.fromString(String.format("00000000-0000-0000-0000-%012d", level));
      folders.add(new FolderNode(id, parent, "L" + level));
      deepest = id;
      parent = id;
    }

    assertEquals(8, ViewPlacementRules.depth(folders, deepest));
    assertFalse(ViewPlacementRules.canCreateIn(folders, deepest));
    assertTrue(ViewPlacementRules.canCreateIn(folders, folders.get(6).id()));
    assertFalse(ViewPlacementRules.canMoveFolder(folders, folders.get(0).id(), deepest));
  }
}
