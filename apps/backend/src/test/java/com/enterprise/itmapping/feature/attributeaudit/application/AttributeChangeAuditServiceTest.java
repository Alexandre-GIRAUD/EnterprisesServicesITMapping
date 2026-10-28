package com.enterprise.itmapping.feature.attributeaudit.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.LifecycleChange;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditActorType;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeChangeEventEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.AttributeChangeEventRepository;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.EdgeEndpointLookup;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideEntity;
import com.enterprise.itmapping.feature.attributeaudit.infrastructure.persistence.HumanFieldOverrideRepository;
import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
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
class AttributeChangeAuditServiceTest {

  @Mock AttributeChangeEventRepository eventRepository;
  @Mock HumanFieldOverrideRepository overrideRepository;
  @Mock CurrentUserResolver currentUserResolver;
  @Mock EdgeEndpointLookup edgeEndpointLookup;

  @InjectMocks AttributeChangeAuditService service;

  private UserEntity user;

  @BeforeEach
  void setUp() {
    user = new UserEntity();
    user.setId(UUID.randomUUID());
    user.setUsername("alice");
  }

  @Test
  void noOpWhenOldEqualsNewAfterTrim() {
    UUID id =
        service.record(
            AttributeChangeRequest.ai(
                AuditTargetType.APPLICATION,
                "app-1",
                AuditFieldScope.NODE_ATTR,
                "tier",
                " GOLD ",
                "GOLD",
                "TEST"));
    assertThat(id).isNull();
    verify(eventRepository, never()).save(any());
  }

  @Test
  void recordsClearAsNullNewValue() {
    when(eventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    service.record(
        AttributeChangeRequest.ai(
            AuditTargetType.APPLICATION,
            "app-1",
            AuditFieldScope.NODE_ATTR,
            "tier",
            "GOLD",
            "",
            "TEST"));

    ArgumentCaptor<AttributeChangeEventEntity> captor =
        ArgumentCaptor.forClass(AttributeChangeEventEntity.class);
    verify(eventRepository).save(captor.capture());
    assertThat(captor.getValue().getOldValue()).isEqualTo("GOLD");
    assertThat(captor.getValue().getNewValue()).isNull();
    assertThat(captor.getValue().getActorType()).isEqualTo(AuditActorType.AI);
    verify(overrideRepository, never()).save(any());
  }

  @Test
  void lifecycleChangeWithNobodySignedInIsRecordedAsSystemForItsApplications() {
    when(currentUserResolver.findCurrentUser()).thenReturn(Optional.empty());
    when(eventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    service.recordLifecycle(
        new LifecycleChange(
            AuditTargetType.MODULE,
            "module-1",
            AuditFieldScope.MODULE_LINK,
            "__link__",
            null,
            "{\"name\":\"Billing\"}",
            List.of("app-1")));

    ArgumentCaptor<AttributeChangeEventEntity> captor =
        ArgumentCaptor.forClass(AttributeChangeEventEntity.class);
    verify(eventRepository).save(captor.capture());
    assertThat(captor.getValue().getActorType()).isEqualTo(AuditActorType.AI);
    assertThat(captor.getValue().getAiSource()).isEqualTo(AttributeChangeAuditService.SYSTEM_SOURCE);
    assertThat(captor.getValue().getApplicationIds()).containsExactly("app-1");
    verify(overrideRepository, never()).save(any());
  }

  @Test
  void edgeChangeBelongsToBothEndpointApplications() {
    when(edgeEndpointLookup.applicationIds("edge-1")).thenReturn(List.of("app-1", "app-2"));
    when(eventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    service.record(
        AttributeChangeRequest.ai(
            AuditTargetType.EDGE, "edge-1", AuditFieldScope.EDGE_ATTR, "protocol", null, "REST", "TEST"));

    ArgumentCaptor<AttributeChangeEventEntity> captor =
        ArgumentCaptor.forClass(AttributeChangeEventEntity.class);
    verify(eventRepository).save(captor.capture());
    assertThat(captor.getValue().getApplicationIds()).containsExactly("app-1", "app-2");
  }

  @Test
  void humanRequiresReason() {
    assertThatThrownBy(
            () ->
                service.record(
                    new AttributeChangeRequest(
                        AuditTargetType.APPLICATION,
                        "app-1",
                        AuditFieldScope.NODE_ATTR,
                        "tier",
                        null,
                        "GOLD",
                        AuditActorType.HUMAN,
                        null,
                        null,
                        null)))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void othersRequiresComment() {
    assertThatThrownBy(
            () ->
                service.record(
                    AttributeChangeRequest.human(
                        AuditTargetType.APPLICATION,
                        "app-1",
                        AuditFieldScope.NODE_ATTR,
                        "tier",
                        null,
                        "GOLD",
                        HumanChangeReason.Others,
                        "  ")))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void humanUpsertsOverride() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(user);
    when(eventRepository.save(any()))
        .thenAnswer(
            inv -> {
              AttributeChangeEventEntity e = inv.getArgument(0);
              if (e.getId() == null) {
                e.setId(UUID.randomUUID());
              }
              return e;
            });
    when(overrideRepository.findByTargetTypeAndTargetIdAndFieldKey(any(), any(), any()))
        .thenReturn(Optional.empty());
    when(overrideRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    UUID eventId =
        service.record(
            AttributeChangeRequest.human(
                AuditTargetType.APPLICATION,
                "app-1",
                AuditFieldScope.NODE_ATTR,
                "tier",
                "SILVER",
                "GOLD",
                HumanChangeReason.WrongData,
                null));

    assertThat(eventId).isNotNull();
    ArgumentCaptor<HumanFieldOverrideEntity> overrideCaptor =
        ArgumentCaptor.forClass(HumanFieldOverrideEntity.class);
    verify(overrideRepository).save(overrideCaptor.capture());
    assertThat(overrideCaptor.getValue().getProtectedValue()).isEqualTo("GOLD");
    assertThat(overrideCaptor.getValue().getHumanReason()).isEqualTo(HumanChangeReason.WrongData);
    assertThat(overrideCaptor.getValue().getLastHumanEventId()).isEqualTo(eventId);
  }
}
