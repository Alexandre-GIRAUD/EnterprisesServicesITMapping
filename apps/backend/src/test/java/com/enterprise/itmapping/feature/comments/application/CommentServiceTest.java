package com.enterprise.itmapping.feature.comments.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.domain.UserRole;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.comments.domain.CommentTargetType;
import com.enterprise.itmapping.feature.comments.infrastructure.persistence.EntityCommentEntity;
import com.enterprise.itmapping.feature.comments.infrastructure.persistence.EntityCommentRepository;
import com.enterprise.itmapping.feature.comments.presentation.dto.CommentPageResponse;
import com.enterprise.itmapping.feature.comments.presentation.dto.CommentResponse;
import com.enterprise.itmapping.feature.comments.presentation.dto.CreateCommentRequest;
import com.enterprise.itmapping.feature.comments.presentation.dto.UpdateCommentRequest;
import java.time.Instant;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

  @Mock EntityCommentRepository commentRepository;
  @Mock CurrentUserResolver currentUserResolver;
  @InjectMocks CommentService commentService;

  private UserEntity alice;
  private UserEntity bob;
  private UserEntity admin;

  @BeforeEach
  void setUp() {
    alice = user("alice", UserRole.USER);
    bob = user("bob", UserRole.USER);
    admin = user("admin", UserRole.ADMIN);
  }

  @Test
  void createPersistsTrimmedBody() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(alice);
    when(commentRepository.save(any(EntityCommentEntity.class)))
        .thenAnswer(
            inv -> {
              EntityCommentEntity e = inv.getArgument(0);
              // simulate @PrePersist
              try {
                var idField = EntityCommentEntity.class.getDeclaredField("id");
                idField.setAccessible(true);
                idField.set(e, UUID.randomUUID());
                var created = EntityCommentEntity.class.getDeclaredField("createdAt");
                created.setAccessible(true);
                created.set(e, Instant.parse("2026-09-18T12:00:00Z"));
                var updated = EntityCommentEntity.class.getDeclaredField("updatedAt");
                updated.setAccessible(true);
                updated.set(e, Instant.parse("2026-09-18T12:00:00Z"));
              } catch (ReflectiveOperationException ex) {
                throw new RuntimeException(ex);
              }
              return e;
            });

    CommentResponse response =
        commentService.create(
            new CreateCommentRequest(CommentTargetType.APPLICATION, " app-1 ", "  hello  "));

    ArgumentCaptor<EntityCommentEntity> captor = ArgumentCaptor.forClass(EntityCommentEntity.class);
    verify(commentRepository).save(captor.capture());
    assertThat(captor.getValue().getBody()).isEqualTo("hello");
    assertThat(captor.getValue().getTargetId()).isEqualTo("app-1");
    assertThat(response.authorUsername()).isEqualTo("alice");
    assertThat(response.canEdit()).isTrue();
    assertThat(response.canDelete()).isTrue();
  }

  @Test
  void createRejectsBlankBody() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(alice);
    assertThatThrownBy(
            () ->
                commentService.create(
                    new CreateCommentRequest(CommentTargetType.EDGE, "e1", "   ")))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void listReturnsNewestFirstPage() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(alice);
    EntityCommentEntity c = commentOwnedBy(alice, "body");
    when(commentRepository.findByTargetTypeAndTargetIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            eq(CommentTargetType.EDGE), eq("edge-1"), any(PageRequest.class)))
        .thenReturn(new PageImpl<>(List.of(c), PageRequest.of(0, 20), 1));

    CommentPageResponse page =
        commentService.list(CommentTargetType.EDGE, "edge-1", 0, 20);

    assertThat(page.items()).hasSize(1);
    assertThat(page.totalElements()).isEqualTo(1);
    assertThat(page.hasMore()).isFalse();
  }

  @Test
  void updateForbiddenForNonAuthor() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(bob);
    EntityCommentEntity c = commentOwnedBy(alice, "mine");
    when(commentRepository.findByIdAndDeletedAtIsNull(c.getId())).thenReturn(Optional.of(c));

    assertThatThrownBy(
            () -> commentService.update(c.getId(), new UpdateCommentRequest("hijacked")))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.FORBIDDEN);
  }

  @Test
  void deleteAllowedForAdmin() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(admin);
    EntityCommentEntity c = commentOwnedBy(alice, "mine");
    when(commentRepository.findByIdAndDeletedAtIsNull(c.getId())).thenReturn(Optional.of(c));
    when(commentRepository.save(any(EntityCommentEntity.class))).thenAnswer(inv -> inv.getArgument(0));

    commentService.delete(c.getId());

    assertThat(c.getDeletedAt()).isNotNull();
  }

  @Test
  void deleteForbiddenForOtherUser() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(bob);
    EntityCommentEntity c = commentOwnedBy(alice, "mine");
    when(commentRepository.findByIdAndDeletedAtIsNull(c.getId())).thenReturn(Optional.of(c));

    assertThatThrownBy(() -> commentService.delete(c.getId()))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.FORBIDDEN);
  }

  private static UserEntity user(String username, UserRole role) {
    UserEntity u = new UserEntity();
    u.setUsername(username);
    u.setPasswordHash("hash");
    u.setRole(role);
    try {
      var idField = UserEntity.class.getDeclaredField("id");
      idField.setAccessible(true);
      idField.set(u, UUID.randomUUID());
    } catch (ReflectiveOperationException e) {
      throw new RuntimeException(e);
    }
    return u;
  }

  private static EntityCommentEntity commentOwnedBy(UserEntity author, String body) {
    EntityCommentEntity e = new EntityCommentEntity();
    e.setTargetType(CommentTargetType.APPLICATION);
    e.setTargetId("app-1");
    e.setAuthorUserId(author.getId());
    e.setAuthorUsername(author.getUsername());
    e.setBody(body);
    try {
      var idField = EntityCommentEntity.class.getDeclaredField("id");
      idField.setAccessible(true);
      idField.set(e, UUID.randomUUID());
      Instant t = Instant.parse("2026-09-18T10:00:00Z");
      var created = EntityCommentEntity.class.getDeclaredField("createdAt");
      created.setAccessible(true);
      created.set(e, t);
      var updated = EntityCommentEntity.class.getDeclaredField("updatedAt");
      updated.setAccessible(true);
      updated.set(e, t);
    } catch (ReflectiveOperationException ex) {
      throw new RuntimeException(ex);
    }
    return e;
  }
}
