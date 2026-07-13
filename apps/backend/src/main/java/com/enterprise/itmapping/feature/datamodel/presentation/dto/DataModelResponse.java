package com.enterprise.itmapping.feature.datamodel.presentation.dto;

import java.time.Instant;
import java.util.List;

public record DataModelResponse(List<DataModelFieldDto> fields, Instant updatedAt) {}
