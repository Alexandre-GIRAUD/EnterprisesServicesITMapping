package com.enterprise.itmapping.feature.graphsnapshot.application;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotEntity;
import com.enterprise.itmapping.feature.graphsnapshot.infrastructure.persistence.GraphSnapshotRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

  @ExtendWith(MockitoExtension.class)
class GraphSnapshotServiceTest {

  @Mock GraphSnapshotRepository graphSnapshotRepository;
  @Mock CurrentUserResolver currentUserResolver;
  @Mock UserEntity userA;

  @InjectMocks GraphSnapshotService graphSnapshotService;

  private final UUID userAId = UUID.randomUUID();
  private final UUID snapshotId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    SecurityContextHolder.clearContext();
  }

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void deleteForCurrentUserRejectsForeignSnapshot() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(userA);
    when(userA.getId()).thenReturn(userAId);
    when(graphSnapshotRepository.findByIdAndUser_Id(snapshotId, userAId)).thenReturn(Optional.empty());

    assertThrows(
        ResponseStatusException.class, () -> graphSnapshotService.deleteForCurrentUser(snapshotId));

    verify(graphSnapshotRepository, never()).delete(any());
  }

  @Test
  void deleteForCurrentUserDeletesOwnedSnapshot() {
    GraphSnapshotEntity entity = new GraphSnapshotEntity();
    when(currentUserResolver.requireCurrentUser()).thenReturn(userA);
    when(userA.getId()).thenReturn(userAId);
    when(graphSnapshotRepository.findByIdAndUser_Id(snapshotId, userAId))
        .thenReturn(Optional.of(entity));

    graphSnapshotService.deleteForCurrentUser(snapshotId);

    verify(graphSnapshotRepository).delete(entity);
  }
}
