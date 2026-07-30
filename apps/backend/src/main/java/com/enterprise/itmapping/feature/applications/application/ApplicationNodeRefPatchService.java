package com.enterprise.itmapping.feature.applications.application;

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

@Service
public class ApplicationNodeRefPatchService {

  private static final Logger log = LoggerFactory.getLogger(ApplicationNodeRefPatchService.class);

  private final DataModelService dataModelService;
  private final ApplicationNodeRefLinkWriter writer;
  private final DataModelRefActiveLookup refLookup;

  public ApplicationNodeRefPatchService(
      DataModelService dataModelService,
      ApplicationNodeRefLinkWriter writer,
      DataModelRefActiveLookup refLookup) {
    this.dataModelService = dataModelService;
    this.writer = writer;
    this.refLookup = refLookup;
  }

  @Transactional
  public void patch(String applicationId, Map<String, List<String>> rawRefs) {
    List<DataModelField> fields = dataModelService.loadConfig().nodeRefFields();
    if (fields.isEmpty() || rawRefs == null || rawRefs.isEmpty()) {
      return;
    }

    Map<String, DataModelField> byKey = new LinkedHashMap<>();
    for (DataModelField field : fields) {
      byKey.put(field.key(), field);
    }

    Map<String, List<String>> toReplace = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> entry : rawRefs.entrySet()) {
      String key = normalizeKey(entry.getKey());
      DataModelField field = byKey.get(key);
      if (field == null) {
        log.debug("NODE_REF patch ignored key={} (not a Data Model NODE_REF field)", key);
        continue;
      }
      List<String> requested =
          entry.getValue() != null
              ? entry.getValue().stream().filter(StringUtils::hasText).map(String::trim).toList()
              : List.of();
      List<String> validIds = new ArrayList<>();
      Set<String> seen = new LinkedHashSet<>();
      for (String refId : requested) {
        if (!seen.add(refId)) {
          continue;
        }
        if (!refLookup.existsActive(key, refId)) {
          throw new ResponseStatusException(
              HttpStatus.BAD_REQUEST,
              "Reference inconnue ou inactive pour " + key + ": " + refId);
        }
        validIds.add(refId);
      }
      if (!field.multiple() && validIds.size() > 1) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Une seule valeur autorisee pour " + key + " (multiple=false)");
      }
      toReplace.put(key, List.copyOf(validIds));
    }

    writer.replaceLinks(applicationId, toReplace);
  }

  private static String normalizeKey(String key) {
    return key != null ? key.trim().toLowerCase(Locale.ROOT) : "";
  }
}
