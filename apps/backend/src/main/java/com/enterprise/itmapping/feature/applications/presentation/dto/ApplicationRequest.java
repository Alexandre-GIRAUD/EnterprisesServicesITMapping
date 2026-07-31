package com.enterprise.itmapping.feature.applications.presentation.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Identity fields of an Application. Business attributes are not part of this payload: they are
 * declared in the Data Model ({@code target=NODE}) and written through
 * {@code PATCH /applications/{id}/node-attributes}.
 */
public record ApplicationRequest(
    @NotBlank String name,
    String description
) {}
