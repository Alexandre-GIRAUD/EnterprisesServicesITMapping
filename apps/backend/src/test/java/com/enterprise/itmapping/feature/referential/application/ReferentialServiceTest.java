package com.enterprise.itmapping.feature.referential.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributeReader;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.FieldSync;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.ProbeResult;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.SyncResult;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.View;
import com.enterprise.itmapping.feature.referential.domain.ReferentialIdentity;
import com.enterprise.itmapping.feature.referential.domain.ReferentialMapping;
import com.enterprise.itmapping.feature.referential.domain.ReferentialSyncStatus;
import com.enterprise.itmapping.feature.referential.infrastructure.persistence.ReferentialRepository;
import com.enterprise.itmapping.feature.referential.infrastructure.persistence.ReferentialSourceEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ReferentialServiceTest {

  private static final String APP_A = "app-a";
  private static final String URL = "https://203.0.113.1/apps/{externalKey}";

  @Mock ReferentialRepository repository;
  @Mock DataModelService dataModelService;
  @Mock ApplicationService applicationService;
  @Mock ApplicationNodeAttributePatchService patchService;
  @Mock ApplicationNodeAttributeReader reader;
  @Mock ReferentialHttp http;
  @Mock ReferentialMappingProposer proposer;

  private final Map<UUID, ReferentialSourceEntity> store = new ConcurrentHashMap<>();
  private final Map<String, Object> storedAttributes = new LinkedHashMap<>();
  private ReferentialService service;

  @BeforeEach
  void setUp() {
    lenient().when(repository.findById(any())).thenAnswer(invocation -> Optional.ofNullable(store.get(invocation.getArgument(0))));
    lenient().when(repository.findAll()).thenAnswer(invocation -> new ArrayList<>(store.values()));
    lenient().when(repository.save(any())).thenAnswer(invocation -> {
      ReferentialSourceEntity entity = invocation.getArgument(0);
      store.put(entity.getId(), entity);
      return entity;
    });
    lenient().when(repository.existsById(any())).thenAnswer(invocation -> store.containsKey(invocation.getArgument(0)));
    lenient().doAnswer(invocation -> {
      store.remove(invocation.getArgument(0));
      return null;
    }).when(repository).deleteById(any());
    lenient().when(dataModelService.loadConfig()).thenReturn(config(ownerField(), edgeField()));
    lenient().when(applicationService.findById(any())).thenAnswer(invocation -> {
      String id = invocation.getArgument(0);
      if (APP_A.equals(id) || "app-b".equals(id)) {
        return Optional.of(new ApplicationResponse(id, "APP_A", "", false, Map.of()));
      }
      return Optional.empty();
    });
    lenient().when(reader.read(any())).thenAnswer(invocation -> new LinkedHashMap<>(storedAttributes));
    lenient().when(patchService.patchAi(any(), any(), any())).thenAnswer(invocation -> {
      Map<String, ?> incoming = invocation.getArgument(1);
      if (incoming == null) {
        return java.util.Set.of();
      }
      for (Map.Entry<String, ?> entry : incoming.entrySet()) {
        if ("".equals(entry.getValue())) {
          storedAttributes.remove(entry.getKey());
        } else {
          storedAttributes.put(entry.getKey(), entry.getValue());
        }
      }
      return incoming.keySet();
    });
    service =
        new ReferentialService(
            repository, dataModelService, applicationService, patchService, reader, http, proposer);
  }

  @Test
  void syncUsesTheExternalKeyAndWritesTheMappedAttribute() {
    View referential = readyReferential();
    when(http.get(any(), eq("X-Api-Key"), eq("top-secret-value"))).thenReturn("{\"owner\":\"Ada\"}");

    SyncResult result = service.sync(referential.id(), APP_A);

    verify(http).get(eq(URI.create("https://203.0.113.1/apps/APPA")), eq("X-Api-Key"), eq("top-secret-value"));
    assertThat(result.results())
        .containsExactly(new FieldSync(APP_A, "business_owner", ReferentialSyncStatus.WRITTEN));
    assertThat(result.errors()).isEmpty();
    assertThat(storedAttributes).containsEntry("business_owner", "Ada");
  }

  @Test
  void syncSkipsAnApplicationThatHasNoExternalKey() {
    View referential = readyReferential();

    SyncResult result = service.sync(referential.id(), "app-b");

    assertThat(result.results()).isEmpty();
    verifyNoInteractions(http);
  }

  @Test
  void saveRejectsADuplicateExternalKey() {
    View referential = service.create("CMDB", URL, "X-Api-Key");

    assertThatThrownBy(
            () ->
                service.replaceIdentities(
                    referential.id(),
                    List.of(
                        new ReferentialIdentity(APP_A, "APPA"),
                        new ReferentialIdentity("app-b", "APPA"))))
        .isInstanceOf(ResponseStatusException.class);
    assertThat(store.get(referential.id()).getIdentities()).isEmpty();
  }

  @Test
  void saveRejectsANonNodeAttributeAndASecondMappingOfTheSameKey() {
    View first = readyReferential();
    View second = service.create("Other", "https://203.0.113.2/apps/{externalKey}", "X-Api-Key");

    assertThatThrownBy(
            () -> service.replaceMappings(first.id(), List.of(new ReferentialMapping("channel", "channel"))))
        .isInstanceOf(ResponseStatusException.class);
    assertThatThrownBy(
            () ->
                service.replaceMappings(
                    second.id(), List.of(new ReferentialMapping("owner", "business_owner"))))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void missingPathLeavesTheStoredValue() {
    View referential = readyReferential();
    storedAttributes.put("business_owner", "Ada");
    when(http.get(any(), any(), any())).thenReturn("{}");

    SyncResult result = service.sync(referential.id(), APP_A);

    assertThat(result.results())
        .containsExactly(new FieldSync(APP_A, "business_owner", ReferentialSyncStatus.MISSING));
    assertThat(storedAttributes).containsEntry("business_owner", "Ada");
    verify(patchService, never()).patchAi(any(), any(), any());
  }

  @Test
  void explicitNullClearsTheAttribute() {
    View referential = readyReferential();
    storedAttributes.put("business_owner", "Ada");
    when(http.get(any(), any(), any())).thenReturn("{\"owner\":null}");

    SyncResult result = service.sync(referential.id(), APP_A);

    assertThat(result.results())
        .containsExactly(new FieldSync(APP_A, "business_owner", ReferentialSyncStatus.WRITTEN));
    assertThat(storedAttributes).doesNotContainKey("business_owner");
  }

  @Test
  void valueOutsideTheAllowedSetIsLeftUntouched() {
    when(dataModelService.loadConfig()).thenReturn(config(enumOwnerField()));
    View referential = readyReferential();
    storedAttributes.put("business_owner", "GOLD");
    when(http.get(any(), any(), any())).thenReturn("{\"owner\":\"PLATINUM\"}");

    SyncResult result = service.sync(referential.id(), APP_A);

    assertThat(result.results())
        .containsExactly(new FieldSync(APP_A, "business_owner", ReferentialSyncStatus.INVALID));
    assertThat(storedAttributes).containsEntry("business_owner", "GOLD");
    verify(patchService, never()).patchAi(any(), any(), any());
  }

  @Test
  void humanOverrideBlocksADifferentValue() {
    View referential = readyReferential();
    storedAttributes.put("business_owner", "Ada");
    when(http.get(any(), any(), any())).thenReturn("{\"owner\":\"Grace\"}");
    doReturn(java.util.Set.of()).when(patchService).patchAi(any(), any(), any());

    SyncResult result = service.sync(referential.id(), APP_A);

    assertThat(result.results())
        .containsExactly(new FieldSync(APP_A, "business_owner", ReferentialSyncStatus.BLOCKED));
    assertThat(storedAttributes).containsEntry("business_owner", "Ada");
  }

  @Test
  void unchangedValueIsNotWrittenAgain() {
    View referential = readyReferential();
    storedAttributes.put("business_owner", "Ada");
    when(http.get(any(), any(), any())).thenReturn("{\"owner\":\"Ada\"}");

    SyncResult result = service.sync(referential.id(), APP_A);

    assertThat(result.results())
        .containsExactly(new FieldSync(APP_A, "business_owner", ReferentialSyncStatus.UNCHANGED));
    verify(patchService, never()).patchAi(any(), any(), any());
  }

  @Test
  void multipleAttributeReceivesTheWholeList() {
    when(dataModelService.loadConfig()).thenReturn(config(tagsField()));
    View referential = service.create("CMDB", URL, "X-Api-Key");
    service.setSecret(referential.id(), "top-secret-value");
    service.replaceIdentities(referential.id(), List.of(new ReferentialIdentity(APP_A, "APPA")));
    service.replaceMappings(referential.id(), List.of(new ReferentialMapping("tags", "tags")));
    when(http.get(any(), any(), any())).thenReturn("{\"tags\":[\"GOLD\",\"SILVER\"]}");

    service.sync(referential.id(), APP_A);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> written = ArgumentCaptor.forClass(Map.class);
    verify(patchService).patchAi(eq(APP_A), written.capture(), eq("CMDB"));
    assertThat(written.getValue()).containsEntry("tags", List.of("GOLD", "SILVER"));
  }

  @Test
  void proposalIsNotPersisted() {
    View referential = readyReferential();
    service.replaceMappings(referential.id(), List.of());
    store.get(referential.id()).setSampleBody("{\"owner\":\"Ada\",\"tags\":[\"a\"]}");
    when(proposer.propose(any(), any()))
        .thenReturn(
            List.of(
                new ReferentialMapping("owner", "business_owner"),
                new ReferentialMapping("tags", "business_owner"),
                new ReferentialMapping("nope", "not_a_field")));

    List<ReferentialMapping> suggested = service.propose(referential.id());

    assertThat(suggested).containsExactly(new ReferentialMapping("owner", "business_owner"));
    assertThat(store.get(referential.id()).getMappings()).isEmpty();
  }

  @Test
  void failedProbeKeepsThePreviousSample() {
    View referential = readyReferential();
    store.get(referential.id()).setSampleBody("kept-sample");
    when(http.get(any(), any(), any()))
        .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Referential returned HTTP 503."));

    ProbeResult result = service.probe(referential.id(), APP_A);

    assertThat(result.success()).isFalse();
    assertThat(result.message()).contains("503");
    assertThat(store.get(referential.id()).getSampleBody()).isEqualTo("kept-sample");
  }

  @Test
  void readModelOmitsTheSecret() throws Exception {
    View created = service.create("CMDB", URL, "X-Api-Key");
    View view = service.setSecret(created.id(), "top-secret-value");

    String json = new ObjectMapper().writeValueAsString(view);

    assertThat(view.secretConfigured()).isTrue();
    assertThat(json).doesNotContain("top-secret-value");
  }

  @Test
  void privateUrlIsRefusedBeforeTheCall() {
    ReferentialSourceEntity entity = new ReferentialSourceEntity();
    entity.setId(UUID.randomUUID());
    entity.setName("Local");
    entity.setUrlTemplate("https://127.0.0.1/apps/{externalKey}");
    entity.setHeaderName("X-Api-Key");
    entity.setSecret("top-secret-value");
    entity.setIdentities(List.of(new ReferentialIdentity(APP_A, "APPA")));
    entity.setMappings(List.of());
    store.put(entity.getId(), entity);

    assertThatThrownBy(() -> service.probe(entity.getId(), APP_A))
        .isInstanceOf(ResponseStatusException.class);
    verifyNoInteractions(http);
  }

  @Test
  void deleteDropsTheReferentialWithoutWritingAttributes() {
    View referential = readyReferential();
    storedAttributes.put("business_owner", "Ada");

    service.delete(referential.id());

    assertThat(store).doesNotContainKey(referential.id());
    assertThat(storedAttributes).containsEntry("business_owner", "Ada");
    verify(patchService, never()).patchAi(any(), any(), any());
  }

  @Test
  void bindKeepsThePreviousMappingWhenTheNewPathIsInvalid() {
    View referential = readyReferential();

    assertThatThrownBy(() -> service.bind("business_owner", referential.id(), "owner name"))
        .isInstanceOf(ResponseStatusException.class);

    assertThat(store.get(referential.id()).getMappings())
        .containsExactly(new ReferentialMapping("owner", "business_owner"));
  }

  private View readyReferential() {
    View created = service.create("CMDB", URL, "X-Api-Key");
    service.setSecret(created.id(), "top-secret-value");
    service.replaceIdentities(created.id(), List.of(new ReferentialIdentity(APP_A, "APPA")));
    return service.replaceMappings(created.id(), List.of(new ReferentialMapping("owner", "business_owner")));
  }

  private static DataModelConfig config(DataModelField... fields) {
    return new DataModelConfig(List.of(fields));
  }

  private static DataModelField ownerField() {
    return new DataModelField(
        "business_owner",
        "Owner",
        "Who owns it",
        "",
        List.of(),
        false,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.NODE);
  }

  private static DataModelField enumOwnerField() {
    return new DataModelField(
        "business_owner",
        "Owner",
        "",
        "",
        List.of("GOLD", "SILVER"),
        true,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.NODE);
  }

  private static DataModelField tagsField() {
    return new DataModelField(
        "tags",
        "Tags",
        "",
        "",
        List.of(),
        false,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.NODE,
        true);
  }

  private static DataModelField edgeField() {
    return new DataModelField("channel", "Channel", "", "", List.of(), false, false);
  }
}
