package com.enterprise.itmapping.feature.attributeaudit.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.attributeaudit.application.HumanFieldOverrideGuard.Decision;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.domain.OverrideConflictStatus;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeOverrideConflictEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeOverrideConflictRepository;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HumanFieldOverrideGuardTest {

  @Mock HumanFieldOverrideRepository overrideRepository;
  @Mock AttributeOverrideConflictRepository conflictRepository;

  @InjectMocks HumanFieldOverrideGuard guard;

  @Test
  void allowWhenNoOverride() {
    when(overrideRepository.findByTargetTypeAndTargetIdAndFieldKey(any(), any(), any()))
        .thenReturn(Optional.empty());

    Decision d =
        guard.checkAiWrite(
            AuditTargetType.APPLICATION,
            "app-1",
            AuditFieldScope.NODE_ATTR,
            "owner",
            "Bob",
            "TEST");

    assertThat(d).isEqualTo(Decision.ALLOW);
    verify(conflictRepository, never()).save(any());
  }

  @Test
  void allowWhenProposedEqualsProtected() {
    HumanFieldOverrideEntity override = override("Alice");
    when(overrideRepository.findByTargetTypeAndTargetIdAndFieldKey(any(), any(), any()))
        .thenReturn(Optional.of(override));

    Decision d =
        guard.checkAiWrite(
            AuditTargetType.APPLICATION,
            "app-1",
            AuditFieldScope.NODE_ATTR,
            "owner",
            " Alice ",
            "TEST");

    assertThat(d).isEqualTo(Decision.ALLOW);
    verify(conflictRepository, never()).save(any());
  }

  @Test
  void blockAndEnqueueWhenDifferent() {
    HumanFieldOverrideEntity override = override("Alice");
    when(overrideRepository.findByTargetTypeAndTargetIdAndFieldKey(any(), any(), any()))
        .thenReturn(Optional.of(override));
    when(conflictRepository.findByTargetTypeAndTargetIdAndFieldKeyAndStatus(
            any(), any(), any(), any()))
        .thenReturn(Optional.empty());
    when(conflictRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    Decision d =
        guard.checkAiWrite(
            AuditTargetType.APPLICATION,
            "app-1",
            AuditFieldScope.NODE_ATTR,
            "owner",
            "Bob",
            "CONNECTION_SUGGESTION");

    assertThat(d).isEqualTo(Decision.BLOCK_AND_ENQUEUE);
    ArgumentCaptor<AttributeOverrideConflictEntity> captor =
        ArgumentCaptor.forClass(AttributeOverrideConflictEntity.class);
    verify(conflictRepository).save(captor.capture());
    assertThat(captor.getValue().getProtectedValue()).isEqualTo("Alice");
    assertThat(captor.getValue().getProposedValue()).isEqualTo("Bob");
    assertThat(captor.getValue().getStatus()).isEqualTo(OverrideConflictStatus.PENDING);
    assertThat(captor.getValue().getAiSource()).isEqualTo("CONNECTION_SUGGESTION");
  }

  @Test
  void dedupSamePendingProposed() {
    HumanFieldOverrideEntity override = override("Alice");
    when(overrideRepository.findByTargetTypeAndTargetIdAndFieldKey(any(), any(), any()))
        .thenReturn(Optional.of(override));
    AttributeOverrideConflictEntity existing = new AttributeOverrideConflictEntity();
    existing.setProposedValue("Bob");
    existing.setStatus(OverrideConflictStatus.PENDING);
    when(conflictRepository.findByTargetTypeAndTargetIdAndFieldKeyAndStatus(
            any(), any(), any(), any()))
        .thenReturn(Optional.of(existing));

    Decision d =
        guard.checkAiWrite(
            AuditTargetType.APPLICATION,
            "app-1",
            AuditFieldScope.NODE_ATTR,
            "owner",
            "Bob",
            "TEST");

    assertThat(d).isEqualTo(Decision.BLOCK_AND_ENQUEUE);
    verify(conflictRepository, never()).save(any());
  }

  private static HumanFieldOverrideEntity override(String protectedValue) {
    HumanFieldOverrideEntity e = new HumanFieldOverrideEntity();
    e.setTargetType(AuditTargetType.APPLICATION);
    e.setTargetId("app-1");
    e.setFieldKey("owner");
    e.setProtectedValue(protectedValue);
    e.setLastHumanEventId(UUID.randomUUID());
    e.setHumanReason(HumanChangeReason.WrongData);
    return e;
  }
}
