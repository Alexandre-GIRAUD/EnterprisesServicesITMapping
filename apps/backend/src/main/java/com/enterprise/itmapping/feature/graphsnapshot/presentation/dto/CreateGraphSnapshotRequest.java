package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateGraphSnapshotRequest(
    @NotBlank @Size(max = 80) String name, @NotNull @Valid GraphSnapshotFiltersDto filters) {}
