package com.enterprise.itmapping.feature.attributeaudit.application;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.LifecycleChange;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Creation, deletion and renames of applications and modules. Snapshots are JSON so the history
 * stays readable after the Neo4j node is gone.
 */
@Service
public class EntityLifecycleHistory {

  public static final String LINK_FIELD_KEY = "__link__";

  private final AttributeChangeAuditService auditService;
  private final ObjectMapper objectMapper;

  public EntityLifecycleHistory(AttributeChangeAuditService auditService, ObjectMapper objectMapper) {
    this.auditService = auditService;
    this.objectMapper = objectMapper;
  }

  public void applicationCreated(String applicationId, String name, String description) {
    recordApplicationLink(applicationId, null, applicationSnapshot(name, description));
  }

  public void applicationDeleted(String applicationId, String name, String description) {
    recordApplicationLink(applicationId, applicationSnapshot(name, description), null);
  }

  public void applicationFieldChanged(
      String applicationId, String fieldKey, String oldValue, String newValue) {
    auditService.recordLifecycle(
        new LifecycleChange(
            AuditTargetType.APPLICATION,
            applicationId,
            AuditFieldScope.APP_FIELD,
            fieldKey,
            oldValue,
            newValue,
            List.of(applicationId)));
  }

  public void moduleCreated(String applicationId, String moduleId, String name) {
    recordModuleLink(applicationId, moduleId, null, moduleSnapshot(applicationId, name));
  }

  public void moduleDeleted(String applicationId, String moduleId, String name) {
    recordModuleLink(applicationId, moduleId, moduleSnapshot(applicationId, name), null);
  }

  private void recordApplicationLink(String applicationId, String oldSnapshot, String newSnapshot) {
    auditService.recordLifecycle(
        new LifecycleChange(
            AuditTargetType.APPLICATION,
            applicationId,
            AuditFieldScope.APP_LINK,
            LINK_FIELD_KEY,
            oldSnapshot,
            newSnapshot,
            List.of(applicationId)));
  }

  private void recordModuleLink(
      String applicationId, String moduleId, String oldSnapshot, String newSnapshot) {
    auditService.recordLifecycle(
        new LifecycleChange(
            AuditTargetType.MODULE,
            moduleId,
            AuditFieldScope.MODULE_LINK,
            LINK_FIELD_KEY,
            oldSnapshot,
            newSnapshot,
            List.of(applicationId)));
  }

  private String applicationSnapshot(String name, String description) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("name", name);
    body.put("description", description);
    return toJson(body);
  }

  private String moduleSnapshot(String applicationId, String name) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("name", name);
    body.put("applicationId", applicationId);
    return toJson(body);
  }

  private String toJson(Map<String, Object> body) {
    try {
      return objectMapper.writeValueAsString(body);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Failed to serialize lifecycle snapshot", e);
    }
  }
}
