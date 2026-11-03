package com.enterprise.itmapping.feature.referential.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributeReader;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.datamodel.application.AttributeValues;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.referential.application.ReferentialPayload.Outcome;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.FieldSync;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.ProbeResult;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.SyncResult;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.View;
import com.enterprise.itmapping.feature.referential.domain.ReferentialIdentity;
import com.enterprise.itmapping.feature.referential.domain.ReferentialMapping;
import com.enterprise.itmapping.feature.referential.domain.ReferentialSyncStatus;
import com.enterprise.itmapping.feature.referential.infrastructure.persistence.ReferentialRepository;
import com.enterprise.itmapping.feature.referential.infrastructure.persistence.ReferentialSourceEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReferentialService {

  private static final int NAME_LIMIT = 120;
  private static final int PREVIEW_LIMIT = 4_000;
  private static final int SOURCE_LABEL_LIMIT = 64;

  private final ReferentialRepository repository;
  private final DataModelService dataModelService;
  private final ApplicationService applicationService;
  private final ApplicationNodeAttributePatchService patchService;
  private final ApplicationNodeAttributeReader reader;
  private final ReferentialHttp http;
  private final ReferentialMappingProposer proposer;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public ReferentialService(
      ReferentialRepository repository,
      DataModelService dataModelService,
      ApplicationService applicationService,
      ApplicationNodeAttributePatchService patchService,
      ApplicationNodeAttributeReader reader,
      ReferentialHttp http,
      ReferentialMappingProposer proposer) {
    this.repository = repository;
    this.dataModelService = dataModelService;
    this.applicationService = applicationService;
    this.patchService = patchService;
    this.reader = reader;
    this.http = http;
    this.proposer = proposer;
  }

  @Transactional(readOnly = true)
  public List<View> list() {
    return repository.findAll().stream()
        .sorted(Comparator.comparing(entity -> entity.getName().toLowerCase(Locale.ROOT)))
        .map(this::toView)
        .toList();
  }

  @Transactional
  public View create(String name, String urlTemplate, String headerName) {
    ReferentialSourceEntity entity = new ReferentialSourceEntity();
    entity.setId(UUID.randomUUID());
    entity.setName(normalizeName(name, null));
    entity.setUrlTemplate(normalizeTemplate(urlTemplate));
    entity.setHeaderName(cleanHeader(headerName));
    entity.setIdentities(List.of());
    entity.setMappings(List.of());
    return toView(repository.save(entity));
  }

  @Transactional
  public View update(UUID id, String name, String urlTemplate, String headerName) {
    ReferentialSourceEntity entity = require(id);
    entity.setName(normalizeName(name, id));
    entity.setUrlTemplate(normalizeTemplate(urlTemplate));
    entity.setHeaderName(cleanHeader(headerName));
    return toView(repository.save(entity));
  }

  @Transactional
  public View setSecret(UUID id, String secret) {
    ReferentialSourceEntity entity = require(id);
    if (hasLineBreak(secret) || hasLineBreak(entity.getHeaderName())) {
      throw badRequest("Header name and secret must be single-line values.");
    }
    entity.setSecret(StringUtils.hasText(secret) ? secret : null);
    return toView(repository.save(entity));
  }

  @Transactional
  public View replaceIdentities(UUID id, List<ReferentialIdentity> identities) {
    ReferentialSourceEntity entity = require(id);
    entity.setIdentities(validateIdentities(identities));
    return toView(repository.save(entity));
  }

  @Transactional
  public View replaceMappings(UUID id, List<ReferentialMapping> mappings) {
    ReferentialSourceEntity entity = require(id);
    entity.setMappings(validateMappings(id, mappings, sampleTree(entity.getSampleBody()), null));
    return toView(repository.save(entity));
  }

  @Transactional
  public List<View> bind(String fieldKey, UUID referentialId, String path) {
    DataModelField field = requireNodeField(fieldKey);
    if (referentialId == null) {
      removeMapping(field.key());
      return list();
    }
    ReferentialSourceEntity target = require(referentialId);
    List<ReferentialMapping> mappings = new ArrayList<>();
    for (ReferentialMapping mapping : target.getMappings()) {
      if (!field.key().equals(mapping.fieldKey())) {
        mappings.add(mapping);
      }
    }
    mappings.add(new ReferentialMapping(normalizePath(path), field.key()));
    List<ReferentialMapping> validated =
        validateMappings(referentialId, mappings, sampleTree(target.getSampleBody()), field.key());
    removeMapping(field.key());
    target = require(referentialId);
    target.setMappings(validated);
    repository.save(target);
    return list();
  }

  @Transactional
  public void delete(UUID id) {
    if (!repository.existsById(id)) {
      throw notFound();
    }
    repository.deleteById(id);
  }

  public ProbeResult probe(UUID id, String applicationId) {
    ReferentialSourceEntity entity = require(id);
    String externalKey = externalKey(entity, applicationId);
    if (externalKey == null) {
      throw badRequest("This application has no external key on the referential.");
    }
    assertCallable(entity);
    var uri = ReferentialUrls.requestUri(entity.getUrlTemplate(), externalKey);
    try {
      JsonNode tree = fetchObject(uri, entity);
      entity.setSampleBody(tree.toString());
      repository.save(entity);
      return new ProbeResult(true, "Sample stored.", preview(entity.getSampleBody()));
    } catch (RuntimeException ex) {
      return new ProbeResult(false, publicMessage(ex), preview(entity.getSampleBody()));
    }
  }

  @Transactional(readOnly = true)
  public List<ReferentialMapping> propose(UUID id) {
    ReferentialSourceEntity entity = require(id);
    if (!StringUtils.hasText(entity.getSampleBody())) {
      throw badRequest("Probe the referential before asking for a mapping proposal.");
    }
    JsonNode sample = sampleTree(entity.getSampleBody());
    List<DataModelField> candidates = unboundNodeFields(id);
    List<ReferentialMapping> suggested = proposer.propose(entity.getSampleBody(), candidates);
    List<ReferentialMapping> accepted = new ArrayList<>();
    Set<String> seen = new LinkedHashSet<>();
    for (ReferentialMapping mapping : suggested) {
      DataModelField field = nodeField(mapping.fieldKey());
      if (field == null || !seen.add(field.key()) || !candidatesContain(candidates, field.key())) {
        continue;
      }
      if (!ReferentialPayload.isPath(mapping.path())) {
        continue;
      }
      if (sample != null && ReferentialPayload.isArray(sample, mapping.path()) && !field.multiple()) {
        continue;
      }
      accepted.add(new ReferentialMapping(mapping.path().trim(), field.key()));
    }
    return accepted;
  }

  public SyncResult sync(UUID id, String applicationId) {
    ReferentialSourceEntity entity = require(id);
    assertCallable(entity);
    List<FieldSync> results = new ArrayList<>();
    List<String> errors = new ArrayList<>();
    for (ReferentialIdentity identity : identitiesToSync(entity, applicationId)) {
      syncOne(entity, identity, results, errors);
    }
    return new SyncResult(results, errors);
  }

  private void syncOne(
      ReferentialSourceEntity entity,
      ReferentialIdentity identity,
      List<FieldSync> results,
      List<String> errors) {
    if (applicationService.findById(identity.applicationId()).isEmpty()) {
      errors.add("Unknown application " + identity.applicationId() + ".");
      return;
    }
    if (entity.getMappings().isEmpty()) {
      return;
    }
    JsonNode tree;
    try {
      var uri = ReferentialUrls.requestUri(entity.getUrlTemplate(), identity.externalKey());
      tree = fetchObject(uri, entity);
    } catch (RuntimeException ex) {
      errors.add(identity.applicationId() + ": " + publicMessage(ex));
      return;
    }
    applyPayload(entity, identity.applicationId(), tree, results);
  }

  private void applyPayload(
      ReferentialSourceEntity entity, String applicationId, JsonNode tree, List<FieldSync> results) {
    Map<String, Object> current = reader.read(applicationId);
    Map<String, Object> writes = new LinkedHashMap<>();
    List<String> attempted = new ArrayList<>();
    Map<String, String> expected = new LinkedHashMap<>();
    for (ReferentialMapping mapping : entity.getMappings()) {
      DataModelField field = nodeField(mapping.fieldKey());
      if (field == null) {
        results.add(new FieldSync(applicationId, mapping.fieldKey(), ReferentialSyncStatus.INVALID));
        continue;
      }
      Outcome outcome = ReferentialPayload.readField(tree, mapping.path(), field);
      if (outcome.terminal() != null) {
        results.add(new FieldSync(applicationId, field.key(), outcome.terminal()));
        continue;
      }
      String currentDisplay = AttributeValues.display(current.get(field.key()));
      if (outcome.display().equals(currentDisplay)) {
        results.add(new FieldSync(applicationId, field.key(), ReferentialSyncStatus.UNCHANGED));
        continue;
      }
      writes.put(field.key(), outcome.raw());
      attempted.add(field.key());
      expected.put(field.key(), outcome.display());
    }
    if (writes.isEmpty()) {
      return;
    }
    patchService.patchAi(applicationId, writes, sourceLabel(entity.getName()));
    Map<String, Object> after = reader.read(applicationId);
    for (String key : attempted) {
      String actual = AttributeValues.display(after.get(key));
      ReferentialSyncStatus status =
          expected.get(key).equals(actual) ? ReferentialSyncStatus.WRITTEN : ReferentialSyncStatus.BLOCKED;
      results.add(new FieldSync(applicationId, key, status));
    }
  }

  private List<ReferentialIdentity> identitiesToSync(ReferentialSourceEntity entity, String applicationId) {
    if (!StringUtils.hasText(applicationId)) {
      return entity.getIdentities();
    }
    for (ReferentialIdentity identity : entity.getIdentities()) {
      if (identity.applicationId().equals(applicationId.trim())) {
        return List.of(identity);
      }
    }
    return List.of();
  }

  private JsonNode fetchObject(java.net.URI uri, ReferentialSourceEntity entity) {
    String body = http.get(uri, entity.getHeaderName(), entity.getSecret());
    return ReferentialPayload.parseObject(body, objectMapper);
  }

  private void assertCallable(ReferentialSourceEntity entity) {
    if (!StringUtils.hasText(entity.getHeaderName()) || !StringUtils.hasText(entity.getSecret())) {
      throw badRequest("A header name and a secret are required before calling the referential.");
    }
    if (hasLineBreak(entity.getHeaderName()) || hasLineBreak(entity.getSecret())) {
      throw badRequest("Header name and secret must be single-line values.");
    }
    ReferentialUrls.requestUri(entity.getUrlTemplate(), "sample");
  }

  private List<ReferentialIdentity> validateIdentities(List<ReferentialIdentity> identities) {
    List<ReferentialIdentity> cleaned = new ArrayList<>();
    Set<String> applications = new LinkedHashSet<>();
    Set<String> externalKeys = new LinkedHashSet<>();
    for (ReferentialIdentity identity : identities != null ? identities : List.<ReferentialIdentity>of()) {
      String applicationId = identity.applicationId() == null ? "" : identity.applicationId().trim();
      String externalKey = identity.externalKey() == null ? "" : identity.externalKey().trim();
      if (applicationId.isEmpty() || externalKey.isEmpty()) {
        throw badRequest("Each identity row needs an application and an external key.");
      }
      if (externalKey.length() > 200) {
        throw badRequest("An external key must be 200 characters or fewer.");
      }
      if (applicationService.findById(applicationId).isEmpty()) {
        throw badRequest("Unknown application " + applicationId + ".");
      }
      if (!applications.add(applicationId) || !externalKeys.add(externalKey)) {
        throw badRequest("Each application and each external key can appear only once.");
      }
      cleaned.add(new ReferentialIdentity(applicationId, externalKey));
    }
    return cleaned;
  }

  private List<ReferentialMapping> validateMappings(
      UUID referentialId, List<ReferentialMapping> mappings, JsonNode sample, String movingKey) {
    List<ReferentialMapping> cleaned = new ArrayList<>();
    Set<String> fieldKeys = new LinkedHashSet<>();
    Set<String> takenElsewhere = keysOnOtherReferentials(referentialId);
    if (movingKey != null) {
      takenElsewhere.remove(movingKey);
    }
    for (ReferentialMapping mapping : mappings != null ? mappings : List.<ReferentialMapping>of()) {
      DataModelField field = requireNodeField(mapping.fieldKey());
      String path = normalizePath(mapping.path());
      if (!fieldKeys.add(field.key())) {
        throw badRequest("Attribute " + field.key() + " is mapped more than once.");
      }
      if (takenElsewhere.contains(field.key())) {
        throw badRequest("Attribute " + field.key() + " is already filled by another referential.");
      }
      if (sample != null && ReferentialPayload.isArray(sample, path) && !field.multiple()) {
        throw badRequest("Attribute " + field.key() + " is single-value and the sample field is an array.");
      }
      cleaned.add(new ReferentialMapping(path, field.key()));
    }
    return cleaned;
  }

  private Set<String> keysOnOtherReferentials(UUID referentialId) {
    Set<String> keys = new LinkedHashSet<>();
    for (ReferentialSourceEntity entity : repository.findAll()) {
      if (entity.getId().equals(referentialId)) {
        continue;
      }
      for (ReferentialMapping mapping : entity.getMappings()) {
        keys.add(mapping.fieldKey());
      }
    }
    return keys;
  }

  private void removeMapping(String fieldKey) {
    for (ReferentialSourceEntity entity : repository.findAll()) {
      List<ReferentialMapping> kept = new ArrayList<>();
      boolean changed = false;
      for (ReferentialMapping mapping : entity.getMappings()) {
        if (fieldKey.equals(mapping.fieldKey())) {
          changed = true;
        } else {
          kept.add(mapping);
        }
      }
      if (changed) {
        entity.setMappings(kept);
        repository.save(entity);
      }
    }
  }

  private List<DataModelField> unboundNodeFields(UUID referentialId) {
    Set<String> taken = new LinkedHashSet<>();
    for (ReferentialSourceEntity entity : repository.findAll()) {
      for (ReferentialMapping mapping : entity.getMappings()) {
        taken.add(mapping.fieldKey());
      }
    }
    taken.addAll(keysOnOtherReferentials(referentialId));
    return dataModelService.loadConfig().nodeFields().stream()
        .filter(field -> !taken.contains(field.key()))
        .toList();
  }

  private DataModelField requireNodeField(String fieldKey) {
    DataModelField field = nodeField(fieldKey);
    if (field == null) {
      throw badRequest("Only an Application node attribute can be filled by a referential.");
    }
    return field;
  }

  private DataModelField nodeField(String fieldKey) {
    if (fieldKey == null) {
      return null;
    }
    String key = fieldKey.trim().toLowerCase(Locale.ROOT);
    for (DataModelField field : dataModelService.loadConfig().nodeFields()) {
      if (field.key().equals(key)) {
        return field;
      }
    }
    return null;
  }

  private static boolean candidatesContain(List<DataModelField> candidates, String key) {
    for (DataModelField field : candidates) {
      if (field.key().equals(key)) {
        return true;
      }
    }
    return false;
  }

  private String externalKey(ReferentialSourceEntity entity, String applicationId) {
    if (!StringUtils.hasText(applicationId)) {
      return null;
    }
    for (ReferentialIdentity identity : entity.getIdentities()) {
      if (identity.applicationId().equals(applicationId.trim())) {
        return identity.externalKey();
      }
    }
    return null;
  }

  private JsonNode sampleTree(String sampleBody) {
    if (!StringUtils.hasText(sampleBody)) {
      return null;
    }
    try {
      return ReferentialPayload.parseObject(sampleBody, objectMapper);
    } catch (RuntimeException ex) {
      return null;
    }
  }

  private String normalizeName(String name, UUID currentId) {
    String trimmed = name == null ? "" : name.trim();
    if (trimmed.isEmpty() || trimmed.length() > NAME_LIMIT) {
      throw badRequest("Referential name must be 1 to 120 characters.");
    }
    for (ReferentialSourceEntity other : repository.findAll()) {
      if (!other.getId().equals(currentId) && other.getName().equalsIgnoreCase(trimmed)) {
        throw badRequest("A referential with this name already exists.");
      }
    }
    return trimmed;
  }

  private static String normalizeTemplate(String urlTemplate) {
    String trimmed = urlTemplate == null ? "" : urlTemplate.trim();
    ReferentialUrls.requestUri(trimmed, "sample");
    return trimmed;
  }

  private static String normalizePath(String path) {
    String trimmed = path == null ? "" : path.trim();
    if (!ReferentialPayload.isPath(trimmed)) {
      throw badRequest("A mapping path must be a dot path such as owner or team.lead.");
    }
    return trimmed;
  }

  private static String cleanHeader(String headerName) {
    String trimmed = headerName == null ? "" : headerName.trim();
    if (trimmed.length() > 120 || hasLineBreak(trimmed)) {
      throw badRequest("Header name must be a single line of at most 120 characters.");
    }
    return trimmed;
  }

  private static boolean hasLineBreak(String value) {
    return value != null && (value.indexOf('\n') >= 0 || value.indexOf('\r') >= 0);
  }

  private static String sourceLabel(String name) {
    String label = name == null ? "referential" : name.trim();
    return label.length() <= SOURCE_LABEL_LIMIT ? label : label.substring(0, SOURCE_LABEL_LIMIT);
  }

  private static String preview(String sampleBody) {
    if (!StringUtils.hasText(sampleBody)) {
      return "";
    }
    return sampleBody.length() <= PREVIEW_LIMIT ? sampleBody : sampleBody.substring(0, PREVIEW_LIMIT);
  }

  private View toView(ReferentialSourceEntity entity) {
    return new View(
        entity.getId(),
        entity.getName(),
        entity.getUrlTemplate(),
        entity.getHeaderName() == null ? "" : entity.getHeaderName(),
        StringUtils.hasText(entity.getSecret()),
        List.copyOf(entity.getIdentities()),
        List.copyOf(entity.getMappings()),
        preview(entity.getSampleBody()));
  }

  private ReferentialSourceEntity require(UUID id) {
    return repository.findById(id).orElseThrow(this::notFound);
  }

  private ResponseStatusException notFound() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Referential not found.");
  }

  private static ResponseStatusException badRequest(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }

  private static String publicMessage(RuntimeException ex) {
    if (ex instanceof ResponseStatusException status && StringUtils.hasText(status.getReason())) {
      return status.getReason();
    }
    return "Referential call failed.";
  }
}
