package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Manual / AI edition of Data Model {@code target=EDGE} attributes on a {@code DEPENDS_ON}
 * relationship.
 */
@Service
public class GraphEdgeAttributePatchService {

  private static final Logger log = LoggerFactory.getLogger(GraphEdgeAttributePatchService.class);

  private final DataModelService dataModelService;
  private final GraphEdgeAttributeWriter writer;
  private final GraphEdgeAttributeReader reader;
  private final AttributeChangeAuditService auditService;

  public GraphEdgeAttributePatchService(
      DataModelService dataModelService,
      GraphEdgeAttributeWriter writer,
      GraphEdgeAttributeReader reader,
      AttributeChangeAuditService auditService) {
    this.dataModelService = dataModelService;
    this.writer = writer;
    this.reader = reader;
    this.auditService = auditService;
  }

  @Transactional
  public Map<String, String> patchHuman(
      String edgeId, Map<String, String> rawAttributes, AttributeChangeMetaDto changeMeta) {
    if (changeMeta == null || changeMeta.reason() == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "changeMeta.reason is required for human edits.");
    }
    return apply(edgeId, rawAttributes, changeMeta.reason(), changeMeta.reasonComment(), null);
  }

  @Transactional
  public Map<String, String> patchAi(
      String edgeId, Map<String, String> rawAttributes, String aiSource) {
    return apply(edgeId, rawAttributes, null, null, aiSource != null ? aiSource : "AI");
  }

  private Map<String, String> apply(
      String edgeId,
      Map<String, String> rawAttributes,
      HumanChangeReason humanReason,
      String humanReasonComment,
      String aiSource) {
    if (!StringUtils.hasText(edgeId) || !reader.exists(edgeId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Edge not found: " + edgeId);
    }

    List<DataModelField> edgeFields = dataModelService.loadConfig().edgeFields();
    if (edgeFields.isEmpty() || rawAttributes == null || rawAttributes.isEmpty()) {
      return reader.read(edgeId);
    }

    Map<String, DataModelField> byKey = new LinkedHashMap<>();
    for (DataModelField field : edgeFields) {
      byKey.put(field.key(), field);
    }

    Map<String, String> current = reader.read(edgeId);
    Map<String, String> toSet = new LinkedHashMap<>();
    Set<String> toRemove = new LinkedHashSet<>();
    List<AttributeChangeRequest> events = new ArrayList<>();

    for (Map.Entry<String, String> entry : rawAttributes.entrySet()) {
      String key = normalizeKey(entry.getKey());
      DataModelField field = byKey.get(key);
      if (field == null) {
        log.debug("Edge attribute patch ignored key={} (not a Data Model EDGE field)", key);
        continue;
      }
      String value = entry.getValue() != null ? entry.getValue().trim() : "";
      String oldValue = current.get(key);
      if (!StringUtils.hasText(value)) {
        toRemove.add(key);
        events.add(
            buildEvent(edgeId, key, oldValue, null, humanReason, humanReasonComment, aiSource));
        continue;
      }
      String allowed = requireAllowedValue(field, value);
      toSet.put(key, allowed);
      events.add(
          buildEvent(edgeId, key, oldValue, allowed, humanReason, humanReasonComment, aiSource));
    }

    writer.write(edgeId, toSet, byKey.keySet());
    writer.remove(edgeId, toRemove);
    auditService.recordAll(events);
    return reader.read(edgeId);
  }

  private static AttributeChangeRequest buildEvent(
      String edgeId,
      String key,
      String oldValue,
      String newValue,
      HumanChangeReason humanReason,
      String humanReasonComment,
      String aiSource) {
    if (humanReason != null) {
      return AttributeChangeRequest.human(
          AuditTargetType.EDGE,
          edgeId,
          AuditFieldScope.EDGE_ATTR,
          key,
          oldValue,
          newValue,
          humanReason,
          humanReasonComment);
    }
    return AttributeChangeRequest.ai(
        AuditTargetType.EDGE,
        edgeId,
        AuditFieldScope.EDGE_ATTR,
        key,
        oldValue,
        newValue,
        aiSource);
  }

  private static String requireAllowedValue(DataModelField field, String value) {
    if (!field.enforceEnum() || field.allowedValues().isEmpty()) {
      return value;
    }
    for (String allowed : field.allowedValues()) {
      if (allowed.equalsIgnoreCase(value)) {
        return allowed;
      }
    }
    throw new ResponseStatusException(
        HttpStatus.BAD_REQUEST, "Valeur non autorisee pour " + field.key() + ": " + value);
  }

  private static String normalizeKey(String key) {
    return key != null ? key.trim().toLowerCase(Locale.ROOT) : "";
  }
}
