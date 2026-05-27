package com.enterprise.itmapping.feature.applications.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * PATCH body for {@code /applications/{id}/regions}. Each code is normalized (trim, upper case)
 * server-side; unknown codes yield 400. Omit or {@code []} clears all {@code IS_USED_IN}. {@code
 * regionCodes} may be {@code null}: treated as {@code []}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApplicationRegionsPatchRequest(List<String> regionCodes) {}
