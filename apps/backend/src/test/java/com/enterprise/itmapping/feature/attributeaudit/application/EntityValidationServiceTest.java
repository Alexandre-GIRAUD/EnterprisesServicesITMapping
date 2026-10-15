package com.enterprise.itmapping.feature.attributeaudit.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.EntityValidationEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.EntityValidationRepository;
import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributeReader;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class EntityValidationServiceTest {

  private static final Instant FIRST = Instant.parse("2026-03-01T10:00:00Z");
  private static final Instant SECOND = Instant.parse("2026-06-15T08:30:00Z");

  @Mock EntityValidationRepository repository;
  @Mock CurrentUserResolver currentUserResolver;
  @Mock ApplicationRepository applicationRepository;
  @Mock GraphEdgeAttributeReader edgeReader;
  @Mock Clock clock;

  private final Map<String, EntityValidationEntity> stored = new HashMap<>();
  private EntityValidationService service;

  @BeforeEach
  void setUp() {
    service =
        new EntityValidationService(
            repository, currentUserResolver, applicationRepository, edgeReader, clock);
    lenient()
        .when(repository.findById(any()))
        .thenAnswer(invocation -> Optional.ofNullable(stored.get(key(invocation.getArgument(0)))));
    lenient()
        .when(repository.save(any(EntityValidationEntity.class)))
        .thenAnswer(
            invocation -> {
              EntityValidationEntity entity = invocation.getArgument(0);
              stored.put(entity.getTargetType() + ":" + entity.getTargetId(), entity);
              return entity;
            });
  }

  @Test
  void secondConfirmReplacesUsernameAndTime() {
    when(clock.instant()).thenReturn(FIRST, SECOND);
    when(currentUserResolver.requireCurrentUser()).thenReturn(user("alice"), user("bob"));
    when(applicationRepository.findProjectionById("app-1")).thenReturn(Optional.of(projection()));

    EntityValidationService.Stamp first = service.confirm(AuditTargetType.APPLICATION, "app-1");
    EntityValidationService.Stamp second = service.confirm(AuditTargetType.APPLICATION, "app-1");

    assertThat(first.username()).isEqualTo("alice");
    assertThat(first.validatedAt()).isEqualTo(FIRST);
    assertThat(second.username()).isEqualTo("bob");
    assertThat(second.validatedAt()).isEqualTo(SECOND);
    assertThat(service.find(AuditTargetType.APPLICATION, "app-1")).contains(second);
  }

  @Test
  void missingTargetDoesNotCreateARow() {
    when(applicationRepository.findProjectionById("missing")).thenReturn(Optional.empty());
    when(edgeReader.exists("missing-edge")).thenReturn(false);

    assertThatThrownBy(() -> service.confirm(AuditTargetType.APPLICATION, "missing"))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.NOT_FOUND);
    assertThatThrownBy(() -> service.confirm(AuditTargetType.EDGE, "missing-edge"))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.NOT_FOUND);
    assertThatThrownBy(() -> service.confirm(AuditTargetType.APPLICATION, "  "))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.BAD_REQUEST);

    assertThat(service.find(AuditTargetType.APPLICATION, "missing")).isEmpty();
    assertThat(service.find(AuditTargetType.EDGE, "missing-edge")).isEmpty();
    assertThat(stored).isEmpty();
  }

  private static String key(EntityValidationEntity.Pk id) {
    return id.getTargetType() + ":" + id.getTargetId();
  }

  private static UserEntity user(String username) {
    UserEntity user = new UserEntity();
    user.setId(UUID.randomUUID());
    user.setUsername(username);
    return user;
  }

  private static com.enterprise.itmapping.feature.applications.infrastructure.persistence
          .ApplicationGraphNodeProjection
      projection() {
    return new com.enterprise.itmapping.feature.applications.infrastructure.persistence
        .ApplicationGraphNodeProjection() {
      @Override
      public String getId() {
        return "app-1";
      }

      @Override
      public String getName() {
        return "Billing";
      }

      @Override
      public String getDescription() {
        return null;
      }
    };
  }
}
