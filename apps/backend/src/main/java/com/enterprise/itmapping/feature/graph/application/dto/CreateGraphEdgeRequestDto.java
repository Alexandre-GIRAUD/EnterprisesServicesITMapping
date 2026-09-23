package com.enterprise.itmapping.feature.graph.application.dto;

import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;
import jakarta.validation.constraints.NotBlank;

public record CreateGraphEdgeRequestDto(
    @NotBlank String sourceId,
    @NotBlank String targetId,
    @NotBlank String type,
    AttributeChangeMetaDto changeMeta
) {
  public CreateGraphEdgeRequestDto(String sourceId, String targetId, String type) {
    this(sourceId, targetId, type, null);
  }
}
