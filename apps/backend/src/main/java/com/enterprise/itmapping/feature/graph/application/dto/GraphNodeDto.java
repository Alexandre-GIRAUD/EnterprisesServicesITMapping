package com.enterprise.itmapping.feature.graph.application.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record GraphNodeDto(
    String id,
    String label,
    String type,
    /** Reference year of the node (Application/Module); omitted when null. */
    Integer year,
    /** Neo4j node property; populated on module-graph only (omitted when null). */
    String description
) {}
