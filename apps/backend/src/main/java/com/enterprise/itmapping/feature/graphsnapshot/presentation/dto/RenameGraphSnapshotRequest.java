package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenameGraphSnapshotRequest(@NotBlank @Size(max = 80) String name) {}
