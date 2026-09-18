package com.enterprise.itmapping.feature.comments.presentation;

import com.enterprise.itmapping.feature.comments.application.CommentService;
import com.enterprise.itmapping.feature.comments.domain.CommentTargetType;
import com.enterprise.itmapping.feature.comments.presentation.dto.CommentPageResponse;
import com.enterprise.itmapping.feature.comments.presentation.dto.CommentResponse;
import com.enterprise.itmapping.feature.comments.presentation.dto.CreateCommentRequest;
import com.enterprise.itmapping.feature.comments.presentation.dto.UpdateCommentRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/comments")
public class CommentController {

  private final CommentService commentService;

  public CommentController(CommentService commentService) {
    this.commentService = commentService;
  }

  @GetMapping
  public CommentPageResponse list(
      @RequestParam CommentTargetType targetType,
      @RequestParam String targetId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return commentService.list(targetType, targetId, page, size);
  }

  @PostMapping
  public ResponseEntity<CommentResponse> create(@Valid @RequestBody CreateCommentRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(commentService.create(request));
  }

  @PatchMapping("/{id}")
  public CommentResponse update(
      @PathVariable UUID id, @Valid @RequestBody UpdateCommentRequest request) {
    return commentService.update(id, request);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    commentService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
