package com.enterprise.itmapping.feature.graph.application.dto;

import java.util.List;

public record GraphResponseDto(
    List<GraphNodeDto> nodes,
    List<GraphEdgeDto> edges
) {}
