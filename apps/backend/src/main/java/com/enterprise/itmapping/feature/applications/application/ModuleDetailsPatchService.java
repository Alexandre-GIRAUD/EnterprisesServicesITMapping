package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.ModuleDetailsStore.ModuleDetails;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Manual edition of a module description, owner, technology and consumed / produced data. */
@Service
public class ModuleDetailsPatchService {

  private final ModuleDetailsStore store;
  private final AttributeChangeAuditService auditService;

  public ModuleDetailsPatchService(
      ModuleDetailsStore store, AttributeChangeAuditService auditService) {
    this.store = store;
    this.auditService = auditService;
  }

  @Transactional
  public void patchHuman(
      String applicationId,
      String moduleId,
      ModuleDetailsPatch patch,
      AttributeChangeMetaDto changeMeta) {
    if (changeMeta == null || changeMeta.reason() == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "changeMeta.reason is required for human edits.");
    }
    ModuleDetails current =
        store
            .read(applicationId, moduleId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found."));

    ModuleDetails next =
        new ModuleDetails(
            pick(patch.description(), current.description()),
            pick(patch.owner(), current.owner()),
            pick(patch.technology(), current.technology()),
            pickList(patch.dataIn(), current.dataIn()),
            pickList(patch.dataOut(), current.dataOut()));

    List<AttributeChangeRequest> events = new ArrayList<>();
    addEvent(events, moduleId, "description", current.description(), next.description(), changeMeta);
    addEvent(events, moduleId, "owner", current.owner(), next.owner(), changeMeta);
    addEvent(events, moduleId, "technology", current.technology(), next.technology(), changeMeta);
    addEvent(events, moduleId, "dataIn", join(current.dataIn()), join(next.dataIn()), changeMeta);
    addEvent(events, moduleId, "dataOut", join(current.dataOut()), join(next.dataOut()), changeMeta);

    store.write(moduleId, next);
    auditService.recordAll(events);
  }

  private static void addEvent(
      List<AttributeChangeRequest> events,
      String moduleId,
      String key,
      String oldValue,
      String newValue,
      AttributeChangeMetaDto changeMeta) {
    if (Objects.equals(blankToNull(oldValue), blankToNull(newValue))) {
      return;
    }
    events.add(
        AttributeChangeRequest.human(
            AuditTargetType.MODULE,
            moduleId,
            AuditFieldScope.MODULE_FIELD,
            key,
            blankToNull(oldValue),
            blankToNull(newValue),
            changeMeta.reason(),
            changeMeta.reasonComment()));
  }

  /** Null keeps the stored value, blank clears it. */
  private static String pick(String submitted, String stored) {
    if (submitted == null) {
      return stored;
    }
    return StringUtils.hasText(submitted) ? submitted.trim() : null;
  }

  private static List<String> pickList(List<String> submitted, List<String> stored) {
    if (submitted == null) {
      return stored;
    }
    return submitted.stream().filter(StringUtils::hasText).map(String::trim).distinct().toList();
  }

  private static String join(List<String> values) {
    return values == null || values.isEmpty() ? null : String.join(", ", values);
  }

  private static String blankToNull(String value) {
    return StringUtils.hasText(value) ? value : null;
  }
}
