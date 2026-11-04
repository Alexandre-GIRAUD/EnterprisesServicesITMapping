package com.enterprise.itmapping.feature.breach.presentation.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** For the map: rule ids each application and each flow is in breach of. */
public record BreachSummaryResponse(
    Map<String, List<UUID>> applications, Map<String, List<UUID>> flows) {}
