package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import java.util.List;

/**
 * Partial update of a functional module. A null field is left alone, a blank text or empty list
 * clears it. Human edits carry {@code changeMeta}.
 */
public record ModuleDetailsPatch(
    String description,
    String owner,
    List<String> actors,
    String trigger,
    List<String> dataIn,
    List<String> dataOut,
    AttributeChangeMetaDto changeMeta) {

  public ModuleDetailsPatch(
      String description,
      String owner,
      List<String> actors,
      String trigger,
      List<String> dataIn,
      List<String> dataOut) {
    this(description, owner, actors, trigger, dataIn, dataOut, null);
  }
}
