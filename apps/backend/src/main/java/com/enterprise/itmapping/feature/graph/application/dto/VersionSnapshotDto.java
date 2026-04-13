package com.enterprise.itmapping.feature.graph.application.dto;

import java.time.Instant;

public record VersionSnapshotDto(
    String id,
    String versionTag,
    String description,
    Instant validFrom,
    Instant validTo,
    int linkedNodeCount
) {}
