package com.enterprise.itmapping.feature.comments.application;

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
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CommentService {

  public static final int MAX_BODY_LENGTH = 2000;
  public static final int DEFAULT_PAGE_SIZE = 20;
  public static final int MAX_PAGE_SIZE = 50;

  private final EntityCommentRepository commentRepository;
  private final CurrentUserResolver currentUserResolver;

  public CommentService(
      EntityCommentRepository commentRepository, CurrentUserResolver currentUserResolver) {
    this.commentRepository = commentRepository;
    this.currentUserResolver = currentUserResolver;
  }

  @Transactional(readOnly = true)
  public CommentPageResponse list(CommentTargetType targetType, String targetId, int page, int size) {
    UserEntity current = currentUserResolver.requireCurrentUser();
    String id = requireTargetId(targetId);
    int safePage = Math.max(0, page);
    int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));

    Page<EntityCommentEntity> result =
        commentRepository.findByTargetTypeAndTargetIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            targetType, id, PageRequest.of(safePage, safeSize));

    return new CommentPageResponse(
        result.getContent().stream().map(c -> toResponse(c, current)).toList(),
        safePage,
        safeSize,
        result.getTotalElements(),
        result.hasNext());
  }

  @Transactional
  public CommentResponse create(CreateCommentRequest request) {
    UserEntity current = currentUserResolver.requireCurrentUser();
    String body = normalizeBody(request.body());
    String targetId = requireTargetId(request.targetId());

    EntityCommentEntity entity = new EntityCommentEntity();
    entity.setTargetType(request.targetType());
    entity.setTargetId(targetId);
    entity.setAuthorUserId(current.getId());
    entity.setAuthorUsername(current.getUsername());
    entity.setBody(body);

    return toResponse(commentRepository.save(entity), current);
  }

  @Transactional
  public CommentResponse update(UUID id, UpdateCommentRequest request) {
    UserEntity current = currentUserResolver.requireCurrentUser();
    EntityCommentEntity entity = requireActive(id);
    if (!entity.getAuthorUserId().equals(current.getId())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can edit this comment.");
    }
    entity.setBody(normalizeBody(request.body()));
    return toResponse(commentRepository.save(entity), current);
  }

  @Transactional
  public void delete(UUID id) {
    UserEntity current = currentUserResolver.requireCurrentUser();
    EntityCommentEntity entity = requireActive(id);
    boolean isAuthor = entity.getAuthorUserId().equals(current.getId());
    boolean isAdmin = current.getRole() == UserRole.ADMIN;
    if (!isAuthor && !isAdmin) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Only the author or an admin can delete this comment.");
    }
    entity.setDeletedAt(Instant.now());
    commentRepository.save(entity);
  }

  private EntityCommentEntity requireActive(UUID id) {
    return commentRepository
        .findByIdAndDeletedAtIsNull(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found."));
  }

  private static String requireTargetId(String targetId) {
    if (!StringUtils.hasText(targetId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetId is required.");
    }
    String trimmed = targetId.trim();
    if (trimmed.length() > 128) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetId is too long.");
    }
    return trimmed;
  }

  private static String normalizeBody(String body) {
    if (body == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "body is required.");
    }
    String trimmed = body.trim();
    if (!StringUtils.hasText(trimmed)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "body must not be blank.");
    }
    if (trimmed.length() > MAX_BODY_LENGTH) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "body must be at most " + MAX_BODY_LENGTH + " characters.");
    }
    return trimmed;
  }

  private static CommentResponse toResponse(EntityCommentEntity entity, UserEntity current) {
    boolean isAuthor = entity.getAuthorUserId().equals(current.getId());
    boolean isAdmin = current.getRole() == UserRole.ADMIN;
    boolean edited = entity.getUpdatedAt().isAfter(entity.getCreatedAt());
    return new CommentResponse(
        entity.getId(),
        entity.getTargetType(),
        entity.getTargetId(),
        entity.getBody(),
        entity.getAuthorUsername(),
        entity.getAuthorUserId(),
        entity.getCreatedAt(),
        entity.getUpdatedAt(),
        edited,
        isAuthor,
        isAuthor || isAdmin);
  }
}
