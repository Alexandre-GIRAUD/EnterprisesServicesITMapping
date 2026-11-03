package com.enterprise.itmapping.feature.sources.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubTokenCipher;
import com.enterprise.itmapping.feature.sources.domain.SourceAuthType;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.DataSourceEntity;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.DataSourceRepository;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.SourceMappingEntity;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.SourceMappingRepository;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.ApplicationRef;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.MappingAlertDto;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.MappingEntryDto;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.MappingResponse;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourceNameDto;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourcePreviewResponse;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourceRequest;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourceResponse;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SyncResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Data sources that fill Data Model NODE attributes: definition, application mapping, sync and the
 * alert listing applications still waiting for a mapping decision.
 *
 * <p>Calls to a source are network round trips, so they never run inside a database transaction.
 */
@Service
public class SourceService {

  private static final Logger log = LoggerFactory.getLogger(SourceService.class);
  private static final String ATTRIBUTE_WRITER = "SOURCE";
  /** Loads every application: no id is excluded. */
  private static final String NO_EXCLUDED_APPLICATION = "";

  private final DataSourceRepository sources;
  private final SourceMappingRepository mappings;
  private final SourceRowsFetcher fetcher;
  private final DataModelService dataModel;
  private final ApplicationCatalogQuery catalog;
  private final ApplicationNodeAttributePatchService attributes;
  private final JwtProperties jwt;

  public SourceService(
      DataSourceRepository sources,
      SourceMappingRepository mappings,
      SourceRowsFetcher fetcher,
      DataModelService dataModel,
      ApplicationCatalogQuery catalog,
      ApplicationNodeAttributePatchService attributes,
      JwtProperties jwt) {
    this.sources = sources;
    this.mappings = mappings;
    this.fetcher = fetcher;
    this.dataModel = dataModel;
    this.catalog = catalog;
    this.attributes = attributes;
    this.jwt = jwt;
  }

  @Transactional(readOnly = true)
  public List<SourceResponse> list() {
    return sources.findAll().stream().map(SourceService::toResponse).toList();
  }

  /** Names only: safe to show to every user. */
  @Transactional(readOnly = true)
  public List<SourceNameDto> listNames() {
    return sources.findAll().stream()
        .map(source -> new SourceNameDto(source.getId().toString(), source.getName(), source.getKind()))
        .toList();
  }

  @Transactional
  public SourceResponse create(SourceRequest request) {
    DataSourceEntity entity = new DataSourceEntity();
    apply(entity, request);
    return toResponse(sources.save(entity));
  }

  @Transactional
  public SourceResponse update(UUID id, SourceRequest request) {
    DataSourceEntity entity = require(id);
    apply(entity, request);
    return toResponse(sources.save(entity));
  }

  @Transactional
  public void delete(UUID id) {
    require(id);
    if (!fieldsFedBy(id).isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Data Model attributes still use this source.");
    }
    sources.deleteById(id);
  }

  public SourcePreviewResponse preview(UUID id) {
    List<Map<String, Object>> rows = fetchRows(require(id));
    Set<String> columns = new LinkedHashSet<>();
    rows.forEach(row -> columns.addAll(row.keySet()));
    return new SourcePreviewResponse(List.copyOf(columns), rows.size());
  }

  public MappingResponse mapping(UUID id) {
    DataSourceEntity source = require(id);
    List<CatalogRow> applications = catalog.loadExcluding(NO_EXCLUDED_APPLICATION);
    List<String> keys = extractKeys(fetchRows(source), source.getKeyColumn());
    Map<String, String> names = new LinkedHashMap<>();
    applications.forEach(application -> names.put(application.id(), application.name()));
    return new MappingResponse(
        keys,
        applications.stream()
            .map(application -> new ApplicationRef(application.id(), application.name()))
            .toList(),
        savedEntries(id),
        SourceNameMatcher.suggest(names, keys));
  }

  /** Replaces the mapping of this source. Call {@link #sync} afterwards to fill the attributes. */
  @Transactional
  public void saveMapping(UUID id, List<MappingEntryDto> entries) {
    require(id);
    mappings.deleteBySourceId(id);
    mappings.flush();
    entries.stream().filter(SourceService::isDecision).forEach(entry -> mappings.save(toRow(id, entry)));
  }

  public SyncResponse sync(UUID id) {
    DataSourceEntity source = require(id);
    List<DataModelField> fields = fieldsFedBy(id);
    Map<String, String> columns = columnsByField(source, fields);
    List<String> fieldsWithoutColumn =
        fields.stream().map(DataModelField::key).filter(key -> !columns.containsKey(key)).toList();
    SyncCounters counters = new SyncCounters();
    if (!columns.isEmpty()) {
      List<Map<String, Object>> rows = fetchRows(source);
      mappings.findBySourceId(id).stream()
          .filter(mapping -> !mapping.isNoMatch() && StringUtils.hasText(mapping.getSourceKey()))
          .forEach(mapping -> syncApplication(source, rows, columns, mapping, counters));
    }
    return new SyncResponse(
        counters.updated, counters.failed, counters.missingKey, fieldsWithoutColumn);
  }

  /** Applications without any mapping decision, per source that feeds an attribute. */
  @Transactional(readOnly = true)
  public List<MappingAlertDto> alerts() {
    Set<String> usedSourceIds =
        dataModel.loadConfig().nodeFields().stream()
            .filter(DataModelField::hasExternalSource)
            .map(DataModelField::sourceId)
            .collect(Collectors.toSet());
    if (usedSourceIds.isEmpty()) {
      return List.of();
    }
    List<CatalogRow> applications = catalog.loadExcluding(NO_EXCLUDED_APPLICATION);
    Map<String, List<String>> pending =
        SourceMappingAlerts.compute(
            usedSourceIds,
            applications.stream().map(CatalogRow::id).toList(),
            decidedApplications(usedSourceIds));
    Map<String, String> names = new HashMap<>();
    applications.forEach(application -> names.put(application.id(), application.name()));
    List<MappingAlertDto> alerts = new ArrayList<>();
    pending.forEach(
        (sourceId, applicationIds) ->
            sources
                .findById(UUID.fromString(sourceId))
                .ifPresent(
                    source -> alerts.add(toAlert(source, applicationIds, names))));
    return alerts;
  }

  private static MappingAlertDto toAlert(
      DataSourceEntity source, List<String> applicationIds, Map<String, String> names) {
    return new MappingAlertDto(
        source.getId().toString(),
        source.getName(),
        applicationIds.stream().map(id -> new ApplicationRef(id, names.get(id))).toList());
  }

  private Map<String, Set<String>> decidedApplications(Set<String> sourceIds) {
    Map<String, Set<String>> decided = new HashMap<>();
    for (String sourceId : sourceIds) {
      decided.put(
          sourceId,
          mappings.findBySourceId(UUID.fromString(sourceId)).stream()
              .map(SourceMappingEntity::getApplicationId)
              .collect(Collectors.toSet()));
    }
    return decided;
  }

  private void syncApplication(
      DataSourceEntity source,
      List<Map<String, Object>> rows,
      Map<String, String> columns,
      SourceMappingEntity mapping,
      SyncCounters counters) {
    Map<String, Object> row =
        SourceRowValues.findRow(rows, source.getKeyColumn(), mapping.getSourceKey());
    if (row.isEmpty()) {
      counters.missingKey++;
      return;
    }
    Map<String, Object> values = SourceRowValues.extract(row, columns);
    if (values.isEmpty()) {
      return;
    }
    try {
      attributes.patchAi(mapping.getApplicationId(), values, ATTRIBUTE_WRITER);
      counters.updated++;
    } catch (RuntimeException e) {
      log.warn(
          "Source {} value rejected for application {}: {}",
          source.getId(),
          mapping.getApplicationId(),
          e.getMessage());
      counters.failed++;
    }
  }

  private List<DataModelField> fieldsFedBy(UUID sourceId) {
    return dataModel.loadConfig().nodeFields().stream()
        .filter(field -> sourceId.toString().equals(field.sourceId()))
        .toList();
  }

  private static Map<String, String> columnsByField(
      DataSourceEntity source, List<DataModelField> fields) {
    Map<String, String> columns = new LinkedHashMap<>();
    for (DataModelField field : fields) {
      String column = source.getColumnMap().get(field.key());
      if (StringUtils.hasText(column)) {
        columns.put(field.key(), column);
      }
    }
    return columns;
  }

  private List<MappingEntryDto> savedEntries(UUID sourceId) {
    return mappings.findBySourceId(sourceId).stream()
        .map(
            mapping ->
                new MappingEntryDto(
                    mapping.getApplicationId(), mapping.getSourceKey(), mapping.isNoMatch()))
        .toList();
  }

  private static boolean isDecision(MappingEntryDto entry) {
    return entry.noMatch() || StringUtils.hasText(entry.sourceKey());
  }

  private static SourceMappingEntity toRow(UUID sourceId, MappingEntryDto entry) {
    SourceMappingEntity row = new SourceMappingEntity();
    row.setSourceId(sourceId);
    row.setApplicationId(entry.applicationId());
    row.setSourceKey(entry.noMatch() ? null : entry.sourceKey().trim());
    row.setNoMatch(entry.noMatch());
    return row;
  }

  private List<Map<String, Object>> fetchRows(DataSourceEntity source) {
    return fetcher.fetch(source, decryptedSecret(source));
  }

  private static List<String> extractKeys(List<Map<String, Object>> rows, String keyColumn) {
    if (!StringUtils.hasText(keyColumn)) {
      return List.of();
    }
    return rows.stream()
        .map(row -> row.get(keyColumn))
        .filter(value -> value != null)
        .map(String::valueOf)
        .distinct()
        .toList();
  }

  private DataSourceEntity require(UUID id) {
    return sources
        .findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Source not found."));
  }

  private void apply(DataSourceEntity entity, SourceRequest request) {
    String endpoint = request.endpoint().trim();
    boolean isEndpointChanged = entity.getEndpoint() != null && !entity.getEndpoint().equals(endpoint);
    entity.setName(request.name().trim());
    entity.setKind(request.kind());
    entity.setEndpoint(endpoint);
    entity.setToolName(blankToNull(request.toolName()));
    entity.setItemsPath(blankToNull(request.itemsPath()));
    entity.setAuthType(request.authType() != null ? request.authType() : SourceAuthType.NONE);
    entity.setAuthHeaderName(blankToNull(request.authHeaderName()));
    entity.setAuthUsername(blankToNull(request.authUsername()));
    entity.setKeyColumn(blankToNull(request.keyColumn()));
    entity.setColumnMap(cleanColumns(request.columnMap()));
    applySecret(entity, request.secret(), isEndpointChanged);
  }

  /** A stored secret is never sent to a new endpoint: changing it requires typing a secret again. */
  private void applySecret(DataSourceEntity entity, String secret, boolean isEndpointChanged) {
    if (entity.getAuthType() == SourceAuthType.NONE) {
      entity.setSecretEncrypted(null);
    } else if (StringUtils.hasText(secret)) {
      requireEncryptionKey();
      entity.setSecretEncrypted(GitHubTokenCipher.encrypt(secret, jwt.secret()));
    } else if (isEndpointChanged) {
      entity.setSecretEncrypted(null);
    }
  }

  private String decryptedSecret(DataSourceEntity source) {
    if (!StringUtils.hasText(source.getSecretEncrypted())) {
      return null;
    }
    requireEncryptionKey();
    return GitHubTokenCipher.decrypt(source.getSecretEncrypted(), jwt.secret());
  }

  private void requireEncryptionKey() {
    if (!StringUtils.hasText(jwt.secret())) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "Secrets cannot be stored: JWT_SECRET is not set.");
    }
  }

  private static Map<String, String> cleanColumns(Map<String, String> columns) {
    Map<String, String> clean = new LinkedHashMap<>();
    if (columns != null) {
      columns.forEach(
          (key, column) -> {
            if (StringUtils.hasText(key) && StringUtils.hasText(column)) {
              clean.put(key.trim(), column.trim());
            }
          });
    }
    return clean;
  }

  private static String blankToNull(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private static SourceResponse toResponse(DataSourceEntity entity) {
    return new SourceResponse(
        entity.getId().toString(),
        entity.getName(),
        entity.getKind(),
        entity.getEndpoint(),
        entity.getToolName(),
        entity.getItemsPath(),
        entity.getAuthType(),
        entity.getAuthHeaderName(),
        entity.getAuthUsername(),
        StringUtils.hasText(entity.getSecretEncrypted()),
        entity.getKeyColumn(),
        entity.getColumnMap());
  }

  /** Mutable tally of one sync run. */
  private static final class SyncCounters {
    int updated;
    int failed;
    int missingKey;
  }
}
