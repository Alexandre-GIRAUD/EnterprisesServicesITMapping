package com.enterprise.itmapping.feature.applications.presentation.dto;

import java.util.List;
import java.util.Map;

/**
 * Replace {@code CLASSIFIED_AS} links for the submitted NODE_REF keys. Values are catalogue ref
 * <strong>ids</strong>. An empty list clears that key. Keys not declared as Data Model NODE_REF are
 * ignored.
 */
public record ApplicationNodeRefsPatchRequest(Map<String, List<String>> refs) {

  public ApplicationNodeRefsPatchRequest {
    refs = refs != null ? Map.copyOf(refs) : Map.of();
  }
}
