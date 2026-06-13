package com.enterprise.itmapping.feature.graph.application.dto;

import java.util.Map;

public record GraphEdgeDto(
    String id,
    String sourceId,
    String targetId,
    String type,
    String data,
    Map<String, String> properties
) {}
