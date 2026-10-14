package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.application.HumanFieldOverrideGuard;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditActorType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ApplicationNodeAttributePatchServiceTest {

  private static final String APP_ID = "app-1";

  @Mock DataModelService dataModelService;
  @Mock ApplicationNodeAttributeWriter writer;
  @Mock ApplicationNodeAttributeReader reader;
  @Mock AttributeChangeAuditService auditService;
  @Mock HumanFieldOverrideGuard overrideGuard;

  @InjectMocks ApplicationNodeAttributePatchService service;

  @BeforeEach
  void stubGuardAllow() {
    lenient()
        .when(overrideGuard.checkAiWrite(any(), any(), any(), any(), any(), any()))
        .thenReturn(HumanFieldOverrideGuard.Decision.ALLOW);
  }

  @Test
  void writesDeclaredKeysAndIgnoresOthers() {
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeField("tier", List.of(), false), edgeField("channel")));
    when(reader.read(APP_ID)).thenReturn(Map.of());

    Map<String, String> raw = new LinkedHashMap<>();
    raw.put("tier", " GOLD ");
    raw.put("channel", "KAFKA");
    raw.put("name", "hacked");

    service.patch(APP_ID, raw);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, String>> written = ArgumentCaptor.forClass(Map.class);
    verify(writer).write(eq(APP_ID), written.capture(), eq(Set.of("tier")));
    assertThat(written.getValue()).containsExactly(Map.entry("tier", "GOLD"));
    verify(auditService).recordAll(any());
  }

  @Test
  void blankValueClearsTheProperty() {
    when(dataModelService.loadConfig()).thenReturn(config(nodeField("tier", List.of(), false)));
    when(reader.read(APP_ID)).thenReturn(Map.of("tier", (Object) "GOLD"));

    service.patch(APP_ID, Map.of("tier", "   "));

    verify(writer).remove(APP_ID, Set.of("tier"));
  }

  @Test
  void enforcedEnumRejectsUnknownValue() {
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeField("tier", List.of("GOLD", "SILVER"), true)));
    when(reader.read(APP_ID)).thenReturn(Map.of());

    assertThatThrownBy(() -> service.patch(APP_ID, Map.of("tier", "PLATINUM")))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void enforcedEnumNormalizesCaseToTheDeclaredValue() {
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeField("tier", List.of("GOLD"), true)));
    when(reader.read(APP_ID)).thenReturn(Map.of());

    service.patch(APP_ID, Map.of("tier", "gold"));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, String>> written = ArgumentCaptor.forClass(Map.class);
    verify(writer).write(eq(APP_ID), written.capture(), any());
    assertThat(written.getValue()).containsEntry("tier", "GOLD");
  }

  @Test
  void humanPatchRequiresReason() {
    assertThatThrownBy(
            () -> service.patchHuman(APP_ID, Map.of("tier", "GOLD"), null))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void humanPatchRecordsHumanActor() {
    when(dataModelService.loadConfig()).thenReturn(config(nodeField("tier", List.of(), false)));
    when(reader.read(APP_ID)).thenReturn(Map.of());

    service.patchHuman(
        APP_ID,
        Map.of("tier", "GOLD"),
        new AttributeChangeMetaDto(HumanChangeReason.WrongData, null));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<AttributeChangeRequest>> events =
        ArgumentCaptor.forClass(Collection.class);
    verify(auditService).recordAll(events.capture());
    AttributeChangeRequest event = events.getValue().iterator().next();
    assertThat(event.actorType()).isEqualTo(AuditActorType.HUMAN);
    assertThat(event.humanReason()).isEqualTo(HumanChangeReason.WrongData);
    assertThat(event.aiSource()).isNull();
  }

  @Test
  void noOpWhenValueUnchangedStillCallsAudit_serviceFilters() {
    when(dataModelService.loadConfig()).thenReturn(config(nodeField("tier", List.of(), false)));
    when(reader.read(APP_ID)).thenReturn(Map.of("tier", (Object) "GOLD"));

    service.patchAi(APP_ID, Map.of("tier", "GOLD"), "TEST");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<AttributeChangeRequest>> events =
        ArgumentCaptor.forClass(Collection.class);
    verify(auditService).recordAll(events.capture());
    assertThat(events.getValue()).hasSize(1);
    assertThat(events.getValue().iterator().next().actorType()).isEqualTo(AuditActorType.AI);
  }

  @Test
  void aiPatchSkipsFieldWhenGuardBlocks() {
    when(dataModelService.loadConfig()).thenReturn(config(nodeField("owner", List.of(), false)));
    when(reader.read(APP_ID)).thenReturn(Map.of("owner", (Object) "Alice"));
    when(overrideGuard.checkAiWrite(any(), any(), any(), any(), any(), any()))
        .thenReturn(HumanFieldOverrideGuard.Decision.BLOCK_AND_ENQUEUE);

    service.patchAi(APP_ID, Map.of("owner", "Bob"), "CONNECTION_SUGGESTION");

    verify(writer).write(eq(APP_ID), eq(Map.of()), any());
    verify(auditService).recordAll(eq(List.of()));
  }

  @Test
  void multipleFieldStoresTheListAndAuditsBothLists() {
    when(dataModelService.loadConfig())
        .thenReturn(config(multipleNode("zone", List.of("EU", "US"))));
    when(reader.read(APP_ID)).thenReturn(Map.of("zone", (Object) "EU"));

    Map<String, Object> raw = new LinkedHashMap<>();
    raw.put("zone", List.of("us", "EU", "us"));
    service.patchAi(APP_ID, raw, "CONNECTION_SUGGESTION");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> written = ArgumentCaptor.forClass(Map.class);
    verify(writer).write(eq(APP_ID), written.capture(), any());
    assertThat(written.getValue()).containsEntry("zone", List.of("US", "EU"));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<AttributeChangeRequest>> events =
        ArgumentCaptor.forClass(Collection.class);
    verify(auditService).recordAll(events.capture());
    AttributeChangeRequest event = events.getValue().iterator().next();
    assertThat(event.oldValue()).isEqualTo("EU");
    assertThat(event.newValue()).isEqualTo("US, EU");
  }

  @Test
  void detectedValueIsAddedWhenTheFieldAllowsSeveral() {
    when(dataModelService.loadConfig())
        .thenReturn(config(multipleNode("zone", List.of("EU", "US"))));
    when(reader.read(APP_ID)).thenReturn(Map.of("zone", (Object) List.of("EU")));

    service.patchDetectedValue(APP_ID, "zone", "us");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> written = ArgumentCaptor.forClass(Map.class);
    verify(writer).write(eq(APP_ID), written.capture(), any());
    assertThat(written.getValue()).containsEntry("zone", List.of("EU", "US"));
  }

  @Test
  void detectedValueAlreadyStoredDoesNotWrite() {
    when(dataModelService.loadConfig())
        .thenReturn(config(multipleNode("zone", List.of("EU", "US"))));
    when(reader.read(APP_ID)).thenReturn(Map.of("zone", (Object) List.of("EU")));

    service.patchDetectedValue(APP_ID, "zone", "eu");

    verify(writer, org.mockito.Mockito.never()).write(any(), any(), any());
  }

  @Test
  void detectedValueReplacesASingleField() {
    when(dataModelService.loadConfig()).thenReturn(config(nodeField("tier", List.of("GOLD", "SILVER"), true)));
    when(reader.read(APP_ID)).thenReturn(Map.of("tier", (Object) "SILVER"));

    service.patchDetectedValue(APP_ID, "tier", "gold");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> written = ArgumentCaptor.forClass(Map.class);
    verify(writer).write(eq(APP_ID), written.capture(), any());
    assertThat(written.getValue()).containsEntry("tier", "GOLD");
  }

  private static DataModelConfig config(DataModelField... fields) {
    return new DataModelConfig(List.of(fields));
  }

  private static DataModelField nodeField(
      String key, List<String> allowedValues, boolean enforceEnum) {
    return new DataModelField(
        key,
        key,
        "",
        "",
        allowedValues,
        enforceEnum,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.NODE);
  }

  private static DataModelField multipleNode(String key, List<String> allowedValues) {
    return new DataModelField(
        key,
        key,
        "",
        "",
        allowedValues,
        true,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.NODE,
        true);
  }

  private static DataModelField edgeField(String key) {
    return new DataModelField(
        key,
        key,
        "",
        "",
        List.of(),
        false,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.EDGE);
  }
}
