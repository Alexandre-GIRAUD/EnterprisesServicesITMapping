package com.enterprise.itmapping.feature.sources.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import com.enterprise.itmapping.feature.sources.domain.SourceAuthType;
import com.enterprise.itmapping.feature.sources.domain.SourceKind;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.DataSourceEntity;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.DataSourceRepository;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.SourceMappingEntity;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.SourceMappingRepository;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourceRequest;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SyncResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SourceServiceTest {

  private final UUID sourceId = UUID.randomUUID();

  @Mock DataSourceRepository sources;
  @Mock SourceMappingRepository mappings;
  @Mock SourceRowsFetcher fetcher;
  @Mock DataModelService dataModel;
  @Mock ApplicationCatalogQuery catalog;
  @Mock ApplicationNodeAttributePatchService attributes;
  @Mock JwtProperties jwt;

  private SourceService service;
  private DataSourceEntity source;

  @BeforeEach
  void setUp() {
    service = new SourceService(sources, mappings, fetcher, dataModel, catalog, attributes, jwt);
    source = new DataSourceEntity();
    ReflectionTestUtils.setField(source, "id", sourceId);
    source.setName("Referential");
    source.setKind(SourceKind.API);
    source.setEndpoint("https://example.com/apps");
    source.setKeyColumn("ref");
    source.setColumnMap(Map.of("region", "reg"));
    when(sources.findById(sourceId)).thenReturn(java.util.Optional.of(source));
    when(sources.save(any(DataSourceEntity.class))).thenAnswer(call -> call.getArgument(0));
    when(jwt.secret()).thenReturn("jwt-secret-for-tests");
  }

  @Test
  void syncWritesMappedValuesAndCountsMissingKeys() {
    feedRegionFromSource();
    when(fetcher.fetch(any(), any())).thenReturn(List.of(Map.of("ref", "app__1", "reg", "EMEA")));
    when(mappings.findBySourceId(sourceId))
        .thenReturn(
            List.of(
                mapping("a1", "APP__1", false),
                mapping("a2", null, true),
                mapping("a3", "ghost", false)));

    SyncResponse result = service.sync(sourceId);

    verify(attributes).patchAi("a1", Map.of("region", "EMEA"), "SOURCE");
    verify(attributes, never()).patchAi(org.mockito.ArgumentMatchers.eq("a2"), any(), any());
    assertThat(result.updatedApplications()).isEqualTo(1);
    assertThat(result.missingKeyApplications()).isEqualTo(1);
    assertThat(result.failedApplications()).isZero();
  }

  @Test
  void syncKeepsGoingWhenOneApplicationRejectsItsValue() {
    feedRegionFromSource();
    when(fetcher.fetch(any(), any()))
        .thenReturn(
            List.of(Map.of("ref", "k1", "reg", "bad"), Map.of("ref", "k2", "reg", "EMEA")));
    when(mappings.findBySourceId(sourceId))
        .thenReturn(List.of(mapping("a1", "k1", false), mapping("a2", "k2", false)));
    when(attributes.patchAi("a1", Map.of("region", "bad"), "SOURCE"))
        .thenThrow(new IllegalStateException("rejected"));

    SyncResponse result = service.sync(sourceId);

    assertThat(result.failedApplications()).isEqualTo(1);
    assertThat(result.updatedApplications()).isEqualTo(1);
  }

  @Test
  void syncFlagsAnAttributeWithoutColumnAndDoesNotCallTheSource() {
    source.setColumnMap(Map.of());
    feedRegionFromSource();

    SyncResponse result = service.sync(sourceId);

    assertThat(result.fieldsWithoutColumn()).containsExactly("region");
    verify(fetcher, never()).fetch(any(), any());
  }

  @Test
  void deleteIsRefusedWhileAnAttributeUsesTheSource() {
    feedRegionFromSource();

    assertThatThrownBy(() -> service.delete(sourceId))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("still use");
    verify(sources, never()).deleteById(any());
  }

  @Test
  void aStoredSecretIsNotKeptWhenTheEndpointChanges() {
    source.setAuthType(SourceAuthType.BEARER);
    source.setSecretEncrypted("cipher-text");

    service.update(sourceId, request("https://example.com/other", ""));

    assertThat(source.getSecretEncrypted()).isNull();
  }

  @Test
  void aBlankSecretKeepsTheStoredOneWhenTheEndpointIsUnchanged() {
    source.setAuthType(SourceAuthType.BEARER);
    source.setSecretEncrypted("cipher-text");

    var response = service.update(sourceId, request(source.getEndpoint(), ""));

    assertThat(source.getSecretEncrypted()).isEqualTo("cipher-text");
    assertThat(response.secretSet()).isTrue();
  }

  @Test
  void aTypedSecretIsEncryptedAndNeverReturned() {
    var response = service.update(sourceId, request(source.getEndpoint(), "plain-secret"));

    assertThat(source.getSecretEncrypted()).isNotBlank().isNotEqualTo("plain-secret");
    assertThat(response.toString()).doesNotContain("plain-secret");
  }

  private SourceRequest request(String endpoint, String secret) {
    return new SourceRequest(
        "Referential", SourceKind.API, endpoint, null, null, SourceAuthType.BEARER, null, null,
        secret, "ref", Map.of());
  }

  private void feedRegionFromSource() {
    DataModelField region =
        new DataModelField(
            "region", "Region", "", "", List.of(), false, false, DataModelDetection.MANUAL,
            DataModelTarget.NODE, false, sourceId.toString());
    when(dataModel.loadConfig()).thenReturn(new DataModelConfig(List.of(region)));
  }

  private SourceMappingEntity mapping(String applicationId, String key, boolean isNoMatch) {
    SourceMappingEntity row = new SourceMappingEntity();
    row.setSourceId(sourceId);
    row.setApplicationId(applicationId);
    row.setSourceKey(key);
    row.setNoMatch(isNoMatch);
    return row;
  }
}
