package com.enterprise.itmapping.feature.functionaldoc.presentation.dto;

import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload;
import com.enterprise.itmapping.feature.functionaldoc.domain.FunctionalDocStatus;
import java.time.Instant;
import java.util.List;

public record FunctionalDocumentationResponse(
    String applicationId,
    FunctionalDocStatus status,
    String locale,
    AiFunctionalDocPayload payload,
    String sourceRepo,
    List<String> analyzedFiles,
    Instant generatedAt,
    String errorMessage) {}
