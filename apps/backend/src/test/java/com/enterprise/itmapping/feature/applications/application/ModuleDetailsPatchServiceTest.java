package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ModuleDetailsStore.ModuleDetails;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ModuleDetailsPatchServiceTest {

  private static final AttributeChangeMetaDto WRONG_DATA =
      new AttributeChangeMetaDto(HumanChangeReason.WrongData, null);

  @Mock ModuleDetailsStore store;
  @Mock AttributeChangeAuditService auditService;

  @InjectMocks ModuleDetailsPatchService service;

  private static ModuleDetails stored() {
    return new ModuleDetails(
        "Old", "Front office", List.of("Traders"), "Daily", List.of("Trade"), List.of());
  }

  @Test
  void writesOnlySubmittedFieldsAndAuditsEachChange() {
    when(store.read("app-1", "mod-1")).thenReturn(Optional.of(stored()));

    service.patchHuman(
        "app-1",
        "mod-1",
        new ModuleDetailsPatch(
            "New", null, List.of("Traders", "Sales"), null, List.of("Trade", "Cash"), null),
        WRONG_DATA);

    verify(store)
        .write(
            "mod-1",
            new ModuleDetails(
                "New",
                "Front office",
                List.of("Traders", "Sales"),
                "Daily",
                List.of("Trade", "Cash"),
                List.of()));

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
            tuple("description", "Old", "New"),
            tuple("actors", "Traders", "Traders, Sales"),
            tuple("dataIn", "Trade", "Trade, Cash"));
    assertThat(events.getValue())
        .allSatisfy(
            e -> {
              assertThat(e.targetType()).isEqualTo(AuditTargetType.MODULE);
              assertThat(e.targetId()).isEqualTo("mod-1");
              assertThat(e.fieldScope()).isEqualTo(AuditFieldScope.MODULE_FIELD);
              assertThat(e.humanReason()).isEqualTo(HumanChangeReason.WrongData);
            });
  }

  @Test
  void blankValueClearsTheField() {
    when(store.read("app-1", "mod-1")).thenReturn(Optional.of(stored()));

    service.patchHuman(
        "app-1", "mod-1", new ModuleDetailsPatch(null, " ", null, " ", null, null), WRONG_DATA);

    verify(store)
        .write(
            "mod-1",
            new ModuleDetails("Old", null, List.of("Traders"), null, List.of("Trade"), List.of()));
  }

  @Test
  void humanEditWithoutReasonIsRejected() {
    assertThatThrownBy(
            () ->
                service.patchHuman(
                    "app-1",
                    "mod-1",
                    new ModuleDetailsPatch("x", null, null, null, null, null),
                    null))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("changeMeta.reason");
    verify(store, never()).write(any(), any());
  }

  @Test
  void moduleOutsideTheApplicationIsNotFound() {
    when(store.read(eq("app-1"), eq("other"))).thenReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.patchHuman(
                    "app-1",
                    "other",
                    new ModuleDetailsPatch("x", null, null, null, null, null),
                    WRONG_DATA))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("404");
    verify(store, never()).write(any(), any());
  }
}
