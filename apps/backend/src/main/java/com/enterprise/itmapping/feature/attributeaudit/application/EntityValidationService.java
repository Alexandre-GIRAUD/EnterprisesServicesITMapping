package com.enterprise.itmapping.feature.attributeaudit.application;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.EntityValidationEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.EntityValidationRepository;
import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributeReader;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Latest human sign-off of one application or one edge. */
@Service
public class EntityValidationService {

  private final EntityValidationRepository repository;
  private final CurrentUserResolver currentUserResolver;
  private final ApplicationRepository applicationRepository;
  private final GraphEdgeAttributeReader edgeReader;
  private final Clock clock;

  public EntityValidationService(
      EntityValidationRepository repository,
      CurrentUserResolver currentUserResolver,
      ApplicationRepository applicationRepository,
      GraphEdgeAttributeReader edgeReader,
      Clock clock) {
    this.repository = repository;
    this.currentUserResolver = currentUserResolver;
    this.applicationRepository = applicationRepository;
    this.edgeReader = edgeReader;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public Optional<Stamp> find(AuditTargetType targetType, String targetId) {
    if (targetType == null || !StringUtils.hasText(targetId)) {
      return Optional.empty();
    }
    return repository
        .findById(new EntityValidationEntity.Pk(targetType, targetId.trim()))
        .map(row -> new Stamp(row.getValidatedByUsername(), row.getValidatedAt()));
  }

  @Transactional
  public Stamp confirm(AuditTargetType targetType, String targetId) {
    if (targetType == null || !StringUtils.hasText(targetId)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "targetType and targetId are required.");
    }
    String id = targetId.trim();
    requireTarget(targetType, id);
    UserEntity user = currentUserResolver.requireCurrentUser();
    EntityValidationEntity entity =
        repository.findById(new EntityValidationEntity.Pk(targetType, id)).orElseGet(EntityValidationEntity::new);
    entity.setTargetType(targetType);
    entity.setTargetId(id);
    entity.setValidatedByUserId(user.getId());
    entity.setValidatedByUsername(user.getUsername());
    entity.setValidatedAt(clock.instant());
    EntityValidationEntity saved = repository.save(entity);
    return new Stamp(saved.getValidatedByUsername(), saved.getValidatedAt());
  }

  private void requireTarget(AuditTargetType targetType, String targetId) {
    boolean exists =
        switch (targetType) {
          case APPLICATION -> applicationRepository.findProjectionById(targetId).isPresent();
          case EDGE -> edgeReader.exists(targetId);
          case MODULE -> false;
        };
    if (!exists) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, targetType + " not found: " + targetId);
    }
  }

  public record Stamp(String username, Instant validatedAt) {}
}
