package com.enterprise.itmapping.feature.datamodel.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record DataModelPutRequest(@NotNull @Valid List<DataModelFieldDto> fields) {}
