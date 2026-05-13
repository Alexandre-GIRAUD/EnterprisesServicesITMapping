package com.enterprise.itmapping.feature.contributors.presentation.dto;

import com.enterprise.itmapping.feature.applications.presentation.dto.BusinessUnitSummary;
import java.util.List;

public record ContributorDetailResponse(
    String id,
    String firstName,
    String lastName,
    String team,
    BusinessUnitSummary businessUnit,
    ContributorSummaryDto manager,
    List<ContributorLinkedApplicationDto> applications) {}
