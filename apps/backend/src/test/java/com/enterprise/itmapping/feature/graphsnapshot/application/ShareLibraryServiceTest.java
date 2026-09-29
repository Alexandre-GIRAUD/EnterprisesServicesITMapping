package com.enterprise.itmapping.feature.graphsnapshot.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotRepository;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphViewFolderEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphViewFolderRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ShareLibraryServiceTest {

  @Mock UserRepository userRepository;
  @Mock GraphSnapshotRepository graphSnapshotRepository;
  @Mock GraphViewFolderRepository graphViewFolderRepository;
  @Mock CurrentUserResolver currentUserResolver;
  @Mock UserEntity sender;
  @Mock UserEntity recipient;

  @InjectMocks ShareLibraryService shareLibraryService;

  private final UUID senderId = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private final UUID recipientId = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private final UUID viewId = UUID.fromString("00000000-0000-0000-0000-000000000010");

  @BeforeEach
  void setUp() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(sender);
  }

  private void senderIsAlice() {
    when(sender.getId()).thenReturn(senderId);
    when(sender.getUsername()).thenReturn("alice");
  }

  @Test
  void shareViewCopiesThePresetOntoTheRecipientRoot() {
    GraphSnapshotEntity source = new GraphSnapshotEntity();
    source.setName("Payments");
    source.setUser(sender);
    source.setFolderId(UUID.fromString("00000000-0000-0000-0000-000000000099"));
    source.setApplicationIds(List.of("app-1"));
    senderIsAlice();
    when(graphSnapshotRepository.findByIdAndUser_Id(viewId, senderId)).thenReturn(Optional.of(source));
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(recipient));
    when(recipient.getId()).thenReturn(recipientId);
    when(graphSnapshotRepository.existsSiblingName(recipientId, null, "Payments", null)).thenReturn(true);

    shareLibraryService.shareView(viewId, " bob ");

    ArgumentCaptor<GraphSnapshotEntity> saved = ArgumentCaptor.forClass(GraphSnapshotEntity.class);
    verify(graphSnapshotRepository).save(saved.capture());
    assertNotSame(source, saved.getValue());
    assertEquals(recipient, saved.getValue().getUser());
    assertEquals("Payments (from alice)", saved.getValue().getName());
    assertNull(saved.getValue().getFolderId());
    assertEquals(List.of("app-1"), saved.getValue().getApplicationIds());
  }

  @Test
  void shareViewRejectsAnUnknownUsername() {
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.empty());

    assertThrows(ResponseStatusException.class, () -> shareLibraryService.shareView(viewId, "bob"));

    verify(graphSnapshotRepository, never()).save(any());
  }

  @Test
  void shareFolderCopiesTheTreeOntoTheRecipientRoot() {
    UUID teamId = UUID.fromString("00000000-0000-0000-0000-000000000020");
    UUID innerId = UUID.fromString("00000000-0000-0000-0000-000000000021");
    GraphViewFolderEntity inner = folder(innerId, teamId, "Inner");
    GraphViewFolderEntity team = folder(teamId, null, "Team");
    GraphSnapshotEntity inside = new GraphSnapshotEntity();
    inside.setName("Payments");
    inside.setFolderId(innerId);
    inside.setUser(sender);
    inside.setApplicationIds(List.of("app-1"));
    GraphSnapshotEntity outside = new GraphSnapshotEntity();
    outside.setName("Other");
    outside.setFolderId(null);
    outside.setUser(sender);

    senderIsAlice();
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(recipient));
    when(recipient.getId()).thenReturn(recipientId);
    when(graphViewFolderRepository.findByIdAndUser_Id(teamId, senderId)).thenReturn(Optional.of(team));
    when(graphViewFolderRepository.findByUser_IdOrderByNameAsc(senderId)).thenReturn(List.of(inner, team));
    when(graphSnapshotRepository.findByUser_IdOrderByCreatedAtDesc(senderId))
        .thenReturn(List.of(outside, inside));
    when(graphViewFolderRepository.existsSiblingName(eq(recipientId), isNull(), eq("Team"), isNull()))
        .thenReturn(true);
    when(graphViewFolderRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    when(graphSnapshotRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

    shareLibraryService.shareFolder(teamId, "bob");

    ArgumentCaptor<GraphViewFolderEntity> folders = ArgumentCaptor.forClass(GraphViewFolderEntity.class);
    verify(graphViewFolderRepository, times(2)).save(folders.capture());
    GraphViewFolderEntity copiedTeam = folders.getAllValues().get(0);
    GraphViewFolderEntity copiedInner = folders.getAllValues().get(1);
    assertEquals("Team (from alice)", copiedTeam.getName());
    assertNull(copiedTeam.getParentId());
    assertEquals(recipient, copiedTeam.getUser());
    assertEquals("Inner", copiedInner.getName());
    assertEquals(copiedTeam.getId(), copiedInner.getParentId());

    ArgumentCaptor<GraphSnapshotEntity> views = ArgumentCaptor.forClass(GraphSnapshotEntity.class);
    verify(graphSnapshotRepository, times(1)).save(views.capture());
    assertEquals("Payments", views.getValue().getName());
    assertEquals(copiedInner.getId(), views.getValue().getFolderId());
    assertEquals(recipient, views.getValue().getUser());
    assertEquals(List.of("app-1"), views.getValue().getApplicationIds());
  }

  private GraphViewFolderEntity folder(UUID id, UUID parentId, String name) {
    GraphViewFolderEntity entity = new GraphViewFolderEntity();
    entity.setId(id);
    entity.setParentId(parentId);
    entity.setName(name);
    entity.setUser(sender);
    return entity;
  }
}
