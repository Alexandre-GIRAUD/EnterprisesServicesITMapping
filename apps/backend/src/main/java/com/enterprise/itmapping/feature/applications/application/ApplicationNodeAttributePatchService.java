package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.application.HumanFieldOverrideGuard;
import com.enterprise.itmapping.feature.attributeaudit.application.HumanFieldOverrideGuard.Decision;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import com.enterprise.itmapping.feature.datamodel.application.AttributeValues;
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
 * Manual / AI edition of the Data Model {@code target=NODE} attributes of an Application.
 *
 * <p>Only keys declared as Data Model NODE fields are accepted. A blank value clears the property.
 * Human edits require {@link AttributeChangeMetaDto}; AI edits pass {@code aiSource}.
 */
@Service
public class ApplicationNodeAttributePatchService {

  private static final Logger log =
      LoggerFactory.getLogger(ApplicationNodeAttributePatchService.class);

  private final DataModelService dataModelService;
  private final ApplicationNodeAttributeWriter writer;
  private final ApplicationNodeAttributeReader reader;
  private final AttributeChangeAuditService auditService;
  private final HumanFieldOverrideGuard overrideGuard;

  public ApplicationNodeAttributePatchService(
      DataModelService dataModelService,
      ApplicationNodeAttributeWriter writer,
      ApplicationNodeAttributeReader reader,
      AttributeChangeAuditService auditService,
      HumanFieldOverrideGuard overrideGuard) {
    this.dataModelService = dataModelService;
    this.writer = writer;
    this.reader = reader;
    this.auditService = auditService;
    this.overrideGuard = overrideGuard;
  }

  /** Human drawer edit — requires changeMeta.reason. */
  @Transactional
  public void patchHuman(
      String applicationId, Map<String, ?> rawAttributes, AttributeChangeMetaDto changeMeta) {
    if (changeMeta == null || changeMeta.reason() == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "changeMeta.reason is required for human edits.");
    }
    apply(applicationId, rawAttributes, changeMeta.reason(), changeMeta.reasonComment(), null);
  }

  /** AI / system edit — no human reason; records actor=AI. */
  @Transactional
  public void patchAi(String applicationId, Map<String, ?> rawAttributes, String aiSource) {
    apply(applicationId, rawAttributes, null, null, aiSource != null ? aiSource : "AI");
  }

  /** @deprecated Prefer {@link #patchHuman} or {@link #patchAi}. Defaults to AI for backward compat. */
  @Transactional
  public void patch(String applicationId, Map<String, ?> rawAttributes) {
    patchAi(applicationId, rawAttributes, "LEGACY_PATCH");
  }

  /**
   * Change-detection accept. A multiple field gains the value when it is not already there. A
   * single-value field is replaced.
   */
  @Transactional
  public void patchDetectedValue(String applicationId, String key, String value) {
    String normalizedKey = normalizeKey(key);
    DataModelField field = null;
    for (DataModelField candidate : dataModelService.loadConfig().nodeFields()) {
      if (candidate.key().equals(normalizedKey)) {
        field = candidate;
        break;
      }
    }
    if (field == null || !field.multiple()) {
      patchAi(applicationId, Map.of(normalizedKey, value), "CHANGE_DETECTION_ACCEPT");
      return;
    }
    AttributeValues.Parsed parsed = AttributeValues.parse(field, value);
    if (parsed.values().isEmpty()) {
      return;
    }
    String canonical = parsed.values().getFirst();
    List<String> current =
        new ArrayList<>(AttributeValues.coerce(reader.read(applicationId).get(field.key())));
    if (AttributeValues.containsIgnoreCase(current, canonical)) {
      return;
    }
    current.add(canonical);
    Map<String, Object> next = new LinkedHashMap<>();
    next.put(field.key(), current);
    patchAi(applicationId, next, "CHANGE_DETECTION_ACCEPT");
  }

  private void apply(
      String applicationId,
      Map<String, ?> rawAttributes,
      HumanChangeReason humanReason,
      String humanReasonComment,
      String aiSource) {
    List<DataModelField> nodeFields = dataModelService.loadConfig().nodeFields();
    if (nodeFields.isEmpty() || rawAttributes == null || rawAttributes.isEmpty()) {
      return;
    }

    Map<String, DataModelField> byKey = new LinkedHashMap<>();
    for (DataModelField field : nodeFields) {
      byKey.put(field.key(), field);
    }

    Map<String, Object> current = reader.read(applicationId);
    Map<String, Object> toSet = new LinkedHashMap<>();
    Set<String> toRemove = new LinkedHashSet<>();
    List<AttributeChangeRequest> events = new ArrayList<>();

    for (Map.Entry<String, ?> entry : rawAttributes.entrySet()) {
      String key = normalizeKey(entry.getKey());
      DataModelField field = byKey.get(key);
      if (field == null) {
        log.debug("Node attribute patch ignored key={} (not a Data Model NODE field)", key);
        continue;
      }
      AttributeValues.Parsed parsed = AttributeValues.parse(field, entry.getValue());
      if (parsed.rejectedLiteral() != null) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Valeur non autorisee pour " + field.key() + ": " + parsed.rejectedLiteral());
      }
      String oldValue = AttributeValues.display(current.get(key));
      String newValue = parsed.values().isEmpty() ? null : AttributeValues.display(parsed.values());
      Object stored = AttributeValues.stored(field.multiple(), parsed.values());

      if (aiSource != null) {
        Decision decision =
            overrideGuard.checkAiWrite(
                AuditTargetType.APPLICATION,
                applicationId,
                AuditFieldScope.NODE_ATTR,
                key,
                newValue,
                aiSource);
        if (decision == Decision.BLOCK_AND_ENQUEUE) {
          continue;
        }
      }

      if (stored == null) {
        toRemove.add(key);
        events.add(buildEvent(applicationId, key, blankToNull(oldValue), null, humanReason, humanReasonComment, aiSource));
        continue;
      }
      toSet.put(key, stored);
      events.add(buildEvent(applicationId, key, blankToNull(oldValue), newValue, humanReason, humanReasonComment, aiSource));
    }

    writer.write(applicationId, toSet, byKey.keySet());
    writer.remove(applicationId, toRemove);
    auditService.recordAll(events);
  }

  private static AttributeChangeRequest buildEvent(
      String applicationId,
      String key,
      String oldValue,
      String newValue,
      HumanChangeReason humanReason,
      String humanReasonComment,
      String aiSource) {
    if (humanReason != null) {
      return AttributeChangeRequest.human(
          AuditTargetType.APPLICATION,
          applicationId,
          AuditFieldScope.NODE_ATTR,
          key,
          oldValue,
          newValue,
          humanReason,
          humanReasonComment);
    }
    return AttributeChangeRequest.ai(
        AuditTargetType.APPLICATION,
        applicationId,
        AuditFieldScope.NODE_ATTR,
        key,
        oldValue,
        newValue,
        aiSource);
  }

  private static String blankToNull(String value) {
    return StringUtils.hasText(value) ? value : null;
  }

  private static String normalizeKey(String key) {
    return key != null ? key.trim().toLowerCase(Locale.ROOT) : "";
  }
}
