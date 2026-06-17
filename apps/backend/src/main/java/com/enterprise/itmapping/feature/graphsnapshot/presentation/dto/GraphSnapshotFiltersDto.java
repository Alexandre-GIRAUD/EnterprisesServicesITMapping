package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import java.util.List;

public record GraphSnapshotFiltersDto(
    Integer year, List<String> applicationIds, List<String> businessUnitIds, List<String> regionCodes) {}
