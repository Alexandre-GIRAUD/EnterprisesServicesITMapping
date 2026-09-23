package com.enterprise.itmapping.feature.graph.presentation.dto;

import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import java.util.Map;

/**
 * Partial update of Data Model {@code target=EDGE} attributes on a {@code DEPENDS_ON}
 * relationship. Blank values clear the property. Human edits should include {@code changeMeta}.
 */
public record GraphEdgeAttributesPatchRequest(
    Map<String, String> attributes, AttributeChangeMetaDto changeMeta) {

  public GraphEdgeAttributesPatchRequest {
    attributes = attributes != null ? Map.copyOf(attributes) : Map.of();
  }

  public GraphEdgeAttributesPatchRequest(Map<String, String> attributes) {
    this(attributes, null);
  }
}
