package com.enterprise.itmapping.feature.graph.presentation.dto;

import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangeMetaDto;

/** Body for {@code DELETE /graph/edges/{id}} — human deletes require {@code changeMeta}. */
public record GraphEdgeDeleteRequest(AttributeChangeMetaDto changeMeta) {}
