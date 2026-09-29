package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateGraphViewFolderRequest(
    @NotBlank @Size(max = 80) String name, UUID parentId) {}
