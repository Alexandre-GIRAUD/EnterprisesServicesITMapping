package com.enterprise.itmapping.feature.applications.presentation.dto;

import com.enterprise.itmapping.feature.applications.application.BusinessModelPatch;
import com.enterprise.itmapping.feature.applications.application.BusinessModelStore.ModuleLink;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import java.util.List;

/** Body of {@code PATCH /api/applications/{id}/business-model}; absent parts stay as they are. */
public record BusinessModelPatchRequest(
    List<String> businessObjects,
    List<ModuleLink> moduleLinks,
    String mainJourney,
    String scope,
    AttributeChangeMetaDto changeMeta) {

  public BusinessModelPatch toPatch() {
    return new BusinessModelPatch(businessObjects, moduleLinks, mainJourney, scope);
  }
}
