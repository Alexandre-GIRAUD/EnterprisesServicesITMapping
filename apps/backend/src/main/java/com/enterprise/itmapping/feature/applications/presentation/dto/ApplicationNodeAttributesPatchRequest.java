package com.enterprise.itmapping.feature.applications.presentation.dto;

import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import java.util.Map;

/**
 * Partial update of the Data Model {@code target=NODE} attributes of an Application.
 *
 * <p>Only the submitted keys are touched. A blank value clears the property. Keys not declared as
 * Data Model NODE fields are ignored. Human edits should include {@code changeMeta}.
 */
public record ApplicationNodeAttributesPatchRequest(
    Map<String, String> attributes, AttributeChangeMetaDto changeMeta) {

  public ApplicationNodeAttributesPatchRequest {
    attributes = attributes != null ? Map.copyOf(attributes) : Map.of();
  }

  public ApplicationNodeAttributesPatchRequest(Map<String, String> attributes) {
    this(attributes, null);
  }
}
