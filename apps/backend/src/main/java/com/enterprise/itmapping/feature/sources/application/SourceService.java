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
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourcePreviewResponse;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourceRequest;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourceResponse;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SyncResponse;
import java.util.ArrayList;
import java.util.Collection;
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
 */
@Service
public class SourceService {

  private static final Logger log = LoggerFactory.getLogger(SourceService.class);
  private static final String WRITER = "SOURCE";

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
    boolean used =
        dataModel.loadConfig().nodeFields().stream()
            .anyMatch(field -> id.toString().equals(field.sourceId()));
    if (used) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Data Model attributes still use this source.");
    }
    sources.deleteById(id);
  }

  @Transactional(readOnly = true)
  public SourcePreviewResponse preview(UUID id) {
    List<Map<String, Object>> rows = rows(require(id));
    Set<String> columns = new LinkedHashSet<>();
    rows.forEach(row -> columns.addAll(row.keySet()));
    return new SourcePreviewResponse(List.copyOf(columns), rows.size());
  }

  @Transactional(readOnly = true)
  public MappingResponse mapping(UUID id) {
    DataSourceEntity source = require(id);
    List<CatalogRow> apps = catalog.loadExcluding("");
    List<String> keys = keys(rows(source), source.getKeyColumn());
    Map<String, String> names = new LinkedHashMap<>();
    apps.forEach(app -> names.put(app.id(), app.name()));
    List<MappingEntryDto> saved =
        mappings.findBySourceId(id).stream()
            .map(m -> new MappingEntryDto(m.getApplicationId(), m.getSourceKey(), m.isNoMatch()))
            .toList();
    return new MappingResponse(
        keys,
        apps.stream().map(app -> new ApplicationRef(app.id(), app.name())).toList(),
        saved,
        SourceNameMatcher.suggest(names, keys));
  }

  /** Replaces the mapping of this source, then fills the attributes from it. */
  @Transactional
  public SyncResponse saveMapping(UUID id, List<MappingEntryDto> entries) {
    require(id);
    mappings.deleteBySourceId(id);
    mappings.flush();
    for (MappingEntryDto entry : entries) {
      boolean hasKey = StringUtils.hasText(entry.sourceKey());
      if (!hasKey && !entry.noMatch()) {
        continue;
      }
      SourceMappingEntity row = new SourceMappingEntity();
      row.setSourceId(id);
      row.setApplicationId(entry.applicationId());
      row.setSourceKey(hasKey && !entry.noMatch() ? entry.sourceKey().trim() : null);
      row.setNoMatch(entry.noMatch());
      mappings.save(row);
    }
    return sync(id);
  }

  @Transactional
  public SyncResponse sync(UUID id) {
    DataSourceEntity source = require(id);
    List<DataModelField> fields =
        dataModel.loadConfig().nodeFields().stream()
            .filter(field -> id.toString().equals(field.sourceId()))
            .toList();
    Map<String, String> columns = new LinkedHashMap<>();
    List<String> withoutColumn = new ArrayList<>();
    for (DataModelField field : fields) {
      String column = source.getColumnMap().get(field.key());
      if (StringUtils.hasText(column)) {
        columns.put(field.key(), column);
      } else {
        withoutColumn.add(field.key());
      }
    }
    int updated = 0;
    int failed = 0;
    if (!columns.isEmpty()) {
      List<Map<String, Object>> rows = rows(source);
      for (SourceMappingEntity mapping : mappings.findBySourceId(id)) {
        if (mapping.isNoMatch() || !StringUtils.hasText(mapping.getSourceKey())) {
          continue;
        }
        Map<String, Object> values =
            SourceRowValues.extract(
                SourceRowValues.findRow(rows, source.getKeyColumn(), mapping.getSourceKey()),
                columns);
        if (values.isEmpty()) {
          continue;
        }
        try {
          attributes.patchAi(mapping.getApplicationId(), values, WRITER);
          updated++;
        } catch (ResponseStatusException e) {
          log.warn("Source {} value rejected for application {}: {}", id, mapping.getApplicationId(), e.getReason());
          failed++;
        }
      }
    }
    return new SyncResponse(updated, failed, withoutColumn);
  }

  /** Applications without any mapping decision, per source that feeds an attribute. */
  @Transactional(readOnly = true)
  public List<MappingAlertDto> alerts() {
    Set<String> used =
        dataModel.loadConfig().nodeFields().stream()
            .filter(DataModelField::hasExternalSource)
            .map(DataModelField::sourceId)
            .collect(Collectors.toSet());
    if (used.isEmpty()) {
      return List.of();
    }
    List<CatalogRow> apps = catalog.loadExcluding("");
    Map<String, String> names = new HashMap<>();
    apps.forEach(app -> names.put(app.id(), app.name()));
    Map<String, Set<String>> decided = new HashMap<>();
    for (String sourceId : used) {
      decided.put(
          sourceId,
          mappings.findBySourceId(UUID.fromString(sourceId)).stream()
              .map(SourceMappingEntity::getApplicationId)
              .collect(Collectors.toSet()));
    }
    Map<String, List<String>> pending =
        SourceMappingAlerts.compute(used, apps.stream().map(CatalogRow::id).toList(), decided);
    List<MappingAlertDto> alerts = new ArrayList<>();
    pending.forEach(
        (sourceId, appIds) ->
            sources
                .findById(UUID.fromString(sourceId))
                .ifPresent(
                    source ->
                        alerts.add(
                            new MappingAlertDto(
                                sourceId,
                                source.getName(),
                                appIds.stream()
                                    .map(appId -> new ApplicationRef(appId, names.get(appId)))
                                    .toList()))));
    return alerts;
  }

  public Set<String> knownIds() {
    return sources.findAll().stream().map(s -> s.getId().toString()).collect(Collectors.toSet());
  }

  private List<Map<String, Object>> rows(DataSourceEntity source) {
    return fetcher.fetch(source, decryptedSecret(source));
  }

  private static List<String> keys(List<Map<String, Object>> rows, String keyColumn) {
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
    entity.setName(request.name().trim());
    entity.setKind(request.kind());
    entity.setEndpoint(request.endpoint().trim());
    entity.setToolName(blankToNull(request.toolName()));
    entity.setItemsPath(blankToNull(request.itemsPath()));
    entity.setAuthType(request.authType() != null ? request.authType() : SourceAuthType.NONE);
    entity.setAuthHeaderName(blankToNull(request.authHeaderName()));
    entity.setAuthUsername(blankToNull(request.authUsername()));
    entity.setKeyColumn(blankToNull(request.keyColumn()));
    entity.setColumnMap(cleanColumns(request.columnMap()));
    if (entity.getAuthType() == SourceAuthType.NONE) {
      entity.setSecretEncrypted(null);
    } else if (StringUtils.hasText(request.secret())) {
      requireEncryptionKey();
      entity.setSecretEncrypted(GitHubTokenCipher.encrypt(request.secret(), jwt.secret()));
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

  private static SourceResponse toResponse(DataSourceEntity e) {
    return new SourceResponse(
        e.getId().toString(),
        e.getName(),
        e.getKind(),
        e.getEndpoint(),
        e.getToolName(),
        e.getItemsPath(),
        e.getAuthType(),
        e.getAuthHeaderName(),
        e.getAuthUsername(),
        StringUtils.hasText(e.getSecretEncrypted()),
        e.getKeyColumn(),
        e.getColumnMap());
  }
}
