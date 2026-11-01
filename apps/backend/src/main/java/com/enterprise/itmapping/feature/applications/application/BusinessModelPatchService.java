package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.BusinessModelStore.BusinessModel;
import com.enterprise.itmapping.feature.applications.application.BusinessModelStore.ModuleLink;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService.AttributeChangeRequest;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditFieldScope;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * Manual edition of the business model of an application: lexicon of business objects, explicit
 * links between its modules, main journey and scope. Each changed part is audited on the
 * application, so it shows in its history.
 */
@Service
public class BusinessModelPatchService {

  private static final String LIST_SEPARATOR = ", ";
  private static final String LINK_SEPARATOR = "; ";

  private record PartChange(String key, String oldValue, String newValue) {}

  private final BusinessModelStore store;
  private final AttributeChangeAuditService auditService;

  public BusinessModelPatchService(
      BusinessModelStore store, AttributeChangeAuditService auditService) {
    this.store = store;
    this.auditService = auditService;
  }

  @Transactional
  public void patchHuman(
      String applicationId, BusinessModelPatch patch, AttributeChangeMetaDto changeMeta) {
    if (changeMeta == null || changeMeta.reason() == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "changeMeta.reason is required for human edits.");
    }
    BusinessModel current =
        store
            .read(applicationId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found."));
    Map<String, String> moduleNames = store.moduleNames(applicationId);

    BusinessModel next =
        new BusinessModel(
            patch.businessObjects() == null
                ? current.businessObjects()
                : distinctTrimmed(patch.businessObjects()),
            keepStoredWhenAbsent(patch.mainJourney(), current.mainJourney()),
            keepStoredWhenAbsent(patch.scope(), current.scope()),
            patch.moduleLinks() == null
                ? current.links()
                : cleanLinks(patch.moduleLinks(), moduleNames));

    List<AttributeChangeRequest> events = new ArrayList<>();
    for (PartChange change : changesBetween(current, next, moduleNames)) {
      addEvent(events, applicationId, change, changeMeta);
    }

    store.write(applicationId, next);
    auditService.recordAll(events);
  }

  private static List<PartChange> changesBetween(
      BusinessModel current, BusinessModel next, Map<String, String> moduleNames) {
    return List.of(
        new PartChange(
            "businessObjects",
            join(current.businessObjects()),
            join(next.businessObjects())),
        new PartChange("mainJourney", current.mainJourney(), next.mainJourney()),
        new PartChange("scope", current.scope(), next.scope()),
        new PartChange(
            "moduleLinks",
            describeLinks(current.links(), moduleNames),
            describeLinks(next.links(), moduleNames)));
  }

  private static void addEvent(
      List<AttributeChangeRequest> events,
      String applicationId,
      PartChange change,
      AttributeChangeMetaDto changeMeta) {
    if (Objects.equals(blankToNull(change.oldValue()), blankToNull(change.newValue()))) {
      return;
    }
    events.add(
        AttributeChangeRequest.human(
            AuditTargetType.APPLICATION,
            applicationId,
            AuditFieldScope.APP_FIELD,
            change.key(),
            blankToNull(change.oldValue()),
            blankToNull(change.newValue()),
            changeMeta.reason(),
            changeMeta.reasonComment()));
  }

  /** Drops self links and duplicates; a link to a module outside the application is a bad request. */
  private static List<ModuleLink> cleanLinks(List<ModuleLink> submitted, Map<String, String> moduleNames) {
    List<ModuleLink> links = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (ModuleLink link : submitted) {
      if (!moduleNames.containsKey(link.sourceId()) || !moduleNames.containsKey(link.targetId())) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "A link must join two modules of the application.");
      }
      String object = link.object() == null ? "" : link.object().trim();
      String key = link.sourceId() + "|" + link.targetId() + "|" + object.toLowerCase(Locale.ROOT);
      if (!link.sourceId().equals(link.targetId()) && seen.add(key)) {
        links.add(new ModuleLink(link.sourceId(), link.targetId(), object));
      }
    }
    return links;
  }

  private static String describeLinks(List<ModuleLink> links, Map<String, String> moduleNames) {
    if (links == null || links.isEmpty()) {
      return null;
    }
    return links.stream()
        .map(
            link ->
                moduleNames.getOrDefault(link.sourceId(), link.sourceId())
                    + " → "
                    + moduleNames.getOrDefault(link.targetId(), link.targetId())
                    + (StringUtils.hasText(link.object()) ? " (" + link.object() + ")" : ""))
        .reduce((left, right) -> left + LINK_SEPARATOR + right)
        .orElse(null);
  }

  /** Null keeps the stored value, blank clears it. */
  private static String keepStoredWhenAbsent(String submitted, String stored) {
    if (submitted == null) {
      return stored;
    }
    return StringUtils.hasText(submitted) ? submitted.trim() : null;
  }

  /** Case-insensitive distinct, keeping the first spelling. */
  private static List<String> distinctTrimmed(List<String> values) {
    Set<String> seen = new HashSet<>();
    List<String> result = new ArrayList<>();
    for (String value : values) {
      if (StringUtils.hasText(value) && seen.add(value.trim().toLowerCase(Locale.ROOT))) {
        result.add(value.trim());
      }
    }
    return result;
  }

  private static String join(List<String> values) {
    return values == null || values.isEmpty() ? null : String.join(LIST_SEPARATOR, values);
  }

  private static String blankToNull(String value) {
    return StringUtils.hasText(value) ? value : null;
  }
}
