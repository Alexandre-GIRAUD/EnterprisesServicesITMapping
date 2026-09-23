package com.enterprise.itmapping.feature.attributeaudit.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.OverrideConflictStatus;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeOverrideConflictEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeOverrideConflictRepository;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideRepository;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeOverrideConflictResponse;
import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributePatchService;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AttributeOverrideConflictServiceTest {

  @Mock AttributeOverrideConflictRepository conflictRepository;
  @Mock HumanFieldOverrideRepository overrideRepository;
  @Mock CurrentUserResolver currentUserResolver;
  @Mock ApplicationNodeAttributePatchService nodeAttributePatchService;
  @Mock GraphEdgeAttributePatchService edgeAttributePatchService;

  @InjectMocks AttributeOverrideConflictService service;

  @Test
  void acceptDeletesOverrideAppliesAiValueAndMarksAccepted() {
    UUID id = UUID.randomUUID();
    AttributeOverrideConflictEntity conflict = pendingNode(id, "Alice", "Bob");
    when(conflictRepository.findById(id)).thenReturn(Optional.of(conflict));
    HumanFieldOverrideEntity override = new HumanFieldOverrideEntity();
    when(overrideRepository.findByTargetTypeAndTargetIdAndFieldKey(
            AuditTargetType.APPLICATION, "app-1", "owner"))
        .thenReturn(Optional.of(override));
    UserEntity user = new UserEntity();
    user.setId(UUID.randomUUID());
    when(currentUserResolver.requireCurrentUser()).thenReturn(user);
    when(conflictRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    AttributeOverrideConflictResponse res = service.accept(id);

    verify(overrideRepository).delete(override);
    verify(nodeAttributePatchService)
        .patchAi("app-1", Map.of("owner", "Bob"), "OVERRIDE_ACCEPT");
    verify(edgeAttributePatchService, never()).patchAi(any(), any(), any());
    assertThat(res.status()).isEqualTo(OverrideConflictStatus.ACCEPTED);
    assertThat(conflict.getResolvedByUserId()).isEqualTo(user.getId());
  }

  @Test
  void rejectKeepsNeo4jAndOverride() {
    UUID id = UUID.randomUUID();
    AttributeOverrideConflictEntity conflict = pendingNode(id, "Alice", "Bob");
    when(conflictRepository.findById(id)).thenReturn(Optional.of(conflict));
    UserEntity user = new UserEntity();
    user.setId(UUID.randomUUID());
    when(currentUserResolver.requireCurrentUser()).thenReturn(user);
    when(conflictRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    AttributeOverrideConflictResponse res = service.reject(id);

    verify(overrideRepository, never()).delete(any());
    verify(nodeAttributePatchService, never()).patchAi(any(), any(), any());
    assertThat(res.status()).isEqualTo(OverrideConflictStatus.REJECTED);
  }

  @Test
  void acceptOnNonPendingReturns409() {
    UUID id = UUID.randomUUID();
    AttributeOverrideConflictEntity conflict = pendingNode(id, "Alice", "Bob");
    conflict.setStatus(OverrideConflictStatus.REJECTED);
    when(conflictRepository.findById(id)).thenReturn(Optional.of(conflict));

    assertThatThrownBy(() -> service.accept(id))
        .isInstanceOf(ResponseStatusException.class)
        .satisfies(
            ex ->
                assertThat(((ResponseStatusException) ex).getStatusCode().value()).isEqualTo(409));
  }

  @Test
  void acceptEdgeAttrUsesEdgePatchService() {
    UUID id = UUID.randomUUID();
    AttributeOverrideConflictEntity conflict = new AttributeOverrideConflictEntity();
    conflict.setId(id);
    conflict.setTargetType(AuditTargetType.EDGE);
    conflict.setTargetId("edge-1");
    conflict.setFieldScope(AuditFieldScope.EDGE_ATTR);
    conflict.setFieldKey("channel");
    conflict.setProtectedValue("HTTP");
    conflict.setProposedValue("KAFKA");
    conflict.setStatus(OverrideConflictStatus.PENDING);
    when(conflictRepository.findById(id)).thenReturn(Optional.of(conflict));
    when(overrideRepository.findByTargetTypeAndTargetIdAndFieldKey(any(), any(), any()))
        .thenReturn(Optional.empty());
    UserEntity user = new UserEntity();
    user.setId(UUID.randomUUID());
    when(currentUserResolver.requireCurrentUser()).thenReturn(user);
    when(conflictRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    service.accept(id);

    verify(edgeAttributePatchService)
        .patchAi(eq("edge-1"), eq(Map.of("channel", "KAFKA")), eq("OVERRIDE_ACCEPT"));
    verify(nodeAttributePatchService, never()).patchAi(any(), any(), any());
  }

  private static AttributeOverrideConflictEntity pendingNode(
      UUID id, String protectedValue, String proposed) {
    AttributeOverrideConflictEntity conflict = new AttributeOverrideConflictEntity();
    conflict.setId(id);
    conflict.setTargetType(AuditTargetType.APPLICATION);
    conflict.setTargetId("app-1");
    conflict.setFieldScope(AuditFieldScope.NODE_ATTR);
    conflict.setFieldKey("owner");
    conflict.setProtectedValue(protectedValue);
    conflict.setProposedValue(proposed);
    conflict.setAiSource("CONNECTION_SUGGESTION");
    conflict.setStatus(OverrideConflictStatus.PENDING);
    return conflict;
  }
}
