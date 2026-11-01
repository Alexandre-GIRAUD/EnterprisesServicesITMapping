package com.enterprise.itmapping.feature.applications.presentation.dto;

import com.enterprise.itmapping.feature.applications.application.ModuleDetailsPatch;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import java.util.List;

/** Body of {@code PATCH /api/applications/{id}/modules/{moduleId}}; absent fields stay as they are. */
public record ModuleDetailsPatchRequest(
    String description,
    String owner,
    String technology,
    List<String> dataIn,
    List<String> dataOut,
    AttributeChangeMetaDto changeMeta) {

  public ModuleDetailsPatch toPatch() {
    return new ModuleDetailsPatch(description, owner, technology, dataIn, dataOut, changeMeta);
  }
}
