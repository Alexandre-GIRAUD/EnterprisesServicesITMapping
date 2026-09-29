package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ShareWithUserRequest(@NotBlank @Size(max = 64) String username) {}
