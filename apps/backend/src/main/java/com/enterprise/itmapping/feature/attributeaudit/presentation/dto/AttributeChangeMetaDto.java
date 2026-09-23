package com.enterprise.itmapping.feature.attributeaudit.presentation.dto;

import com.enterprise.itmapping.feature.attributeaudit.domain.HumanChangeReason;
import jakarta.validation.constraints.Size;

/** Metadata required for HUMAN attribute patches. */
public record AttributeChangeMetaDto(
    HumanChangeReason reason, @Size(max = 1000) String reasonComment) {}
