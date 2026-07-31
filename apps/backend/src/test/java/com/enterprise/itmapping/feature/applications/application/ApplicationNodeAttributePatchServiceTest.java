package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

  @InjectMocks ApplicationNodeAttributePatchService service;

  @Test
  void writesDeclaredKeysAndIgnoresOthers() {
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeField("tier", List.of(), false), edgeField("channel")));

    Map<String, String> raw = new LinkedHashMap<>();
    raw.put("tier", " GOLD ");
    raw.put("channel", "KAFKA");
    raw.put("name", "hacked");

    service.patch(APP_ID, raw);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, String>> written = ArgumentCaptor.forClass(Map.class);
    verify(writer).write(eq(APP_ID), written.capture(), eq(Set.of("tier")));
    assertThat(written.getValue()).containsExactly(Map.entry("tier", "GOLD"));
  }

  @Test
  void blankValueClearsTheProperty() {
    when(dataModelService.loadConfig()).thenReturn(config(nodeField("tier", List.of(), false)));

    service.patch(APP_ID, Map.of("tier", "   "));

    verify(writer).remove(APP_ID, Set.of("tier"));
  }

  @Test
  void enforcedEnumRejectsUnknownValue() {
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeField("tier", List.of("GOLD", "SILVER"), true)));

    assertThatThrownBy(() -> service.patch(APP_ID, Map.of("tier", "PLATINUM")))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void enforcedEnumNormalizesCaseToTheDeclaredValue() {
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeField("tier", List.of("GOLD"), true)));

    service.patch(APP_ID, Map.of("tier", "gold"));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, String>> written = ArgumentCaptor.forClass(Map.class);
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
