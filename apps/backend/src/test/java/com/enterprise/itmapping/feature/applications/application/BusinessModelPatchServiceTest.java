package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.BusinessModelStore.BusinessModel;
import com.enterprise.itmapping.feature.applications.application.BusinessModelStore.ModuleLink;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class BusinessModelPatchServiceTest {

  private static final String APP = "app-1";
  private static final AttributeChangeMetaDto OUTDATED =
      new AttributeChangeMetaDto(HumanChangeReason.OutdatedData, null);

  @Mock BusinessModelStore store;
  @Mock AttributeChangeAuditService auditService;

  @InjectMocks BusinessModelPatchService service;

  @BeforeEach
  void stubStore() {
    lenient()
        .when(store.read(APP))
        .thenReturn(
            Optional.of(
                new BusinessModel(
                    List.of("Trade"),
                    "Capture then value",
                    null,
                    List.of(new ModuleLink("a", "b", "Trade")))));
    lenient()
        .when(store.moduleNames(APP))
        .thenReturn(Map.of("a", "Capture", "b", "Pricing", "c", "Cash"));
  }

  @Test
  void writesChangedPartsAndAuditsThemOnTheApplication() {
    service.patchHuman(
        APP,
        new BusinessModelPatch(
            List.of("Trade", "Position", "trade"),
            List.of(new ModuleLink("a", "b", "Trade"), new ModuleLink("b", "c", "Position")),
            null,
            "Equities only"),
        OUTDATED);

    verify(store)
        .write(
            APP,
            new BusinessModel(
                List.of("Trade", "Position"),
                "Capture then value",
                "Equities only",
                List.of(new ModuleLink("a", "b", "Trade"), new ModuleLink("b", "c", "Position"))));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<AttributeChangeRequest>> events =
        ArgumentCaptor.forClass(Collection.class);
    verify(auditService).recordAll(events.capture());
    assertThat(events.getValue())
        .extracting(
            AttributeChangeRequest::fieldKey,
            AttributeChangeRequest::oldValue,
            AttributeChangeRequest::newValue)
        .containsExactly(
            tuple("businessObjects", "Trade", "Trade, Position"),
            tuple("scope", null, "Equities only"),
            tuple(
                "moduleLinks",
                "Capture → Pricing (Trade)",
                "Capture → Pricing (Trade); Pricing → Cash (Position)"));
    assertThat(events.getValue())
        .allSatisfy(
            e -> {
              assertThat(e.targetType()).isEqualTo(AuditTargetType.APPLICATION);
              assertThat(e.targetId()).isEqualTo(APP);
              assertThat(e.fieldScope()).isEqualTo(AuditFieldScope.APP_FIELD);
              assertThat(e.humanReason()).isEqualTo(HumanChangeReason.OutdatedData);
            });
  }

  @Test
  void dropsSelfLinksAndDuplicates() {
    service.patchHuman(
        APP,
        new BusinessModelPatch(
            null,
            List.of(
                new ModuleLink("a", "a", "Trade"),
                new ModuleLink("a", "b", "Trade"),
                new ModuleLink("a", "b", "trade")),
            null,
            null),
        OUTDATED);

    verify(store)
        .write(
            APP,
            new BusinessModel(
                List.of("Trade"),
                "Capture then value",
                null,
                List.of(new ModuleLink("a", "b", "Trade"))));
  }

  @Test
  void linkToAModuleOutsideTheApplicationIsRejected() {
    assertThatThrownBy(
            () ->
                service.patchHuman(
                    APP,
                    new BusinessModelPatch(
                        null, List.of(new ModuleLink("a", "zzz", "Trade")), null, null),
                    OUTDATED))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("400");
    verify(store, never()).write(any(), any());
  }

  @Test
  void humanEditWithoutReasonIsRejected() {
    assertThatThrownBy(
            () -> service.patchHuman(APP, new BusinessModelPatch(null, null, "x", null), null))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("changeMeta.reason");
    verify(store, never()).write(any(), any());
  }

  @Test
  void unknownApplicationIsNotFound() {
    when(store.read("nope")).thenReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.patchHuman("nope", new BusinessModelPatch(null, null, "x", null), OUTDATED))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("404");
  }
}
