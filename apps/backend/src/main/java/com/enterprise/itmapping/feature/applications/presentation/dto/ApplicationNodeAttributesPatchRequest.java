package com.enterprise.itmapping.feature.applications.presentation.dto;

import java.util.Map;

/**
 * Partial update of the Data Model {@code target=NODE} attributes of an Application.
 *
 * <p>Only the submitted keys are touched. A blank value clears the property. Keys not declared as
 * Data Model NODE fields are ignored.
 */
public record ApplicationNodeAttributesPatchRequest(Map<String, String> attributes) {

  public ApplicationNodeAttributesPatchRequest {
    attributes = attributes != null ? Map.copyOf(attributes) : Map.of();
  }
}
