package com.enterprise.itmapping.feature.breach.presentation.dto;

import java.util.List;

/** What accepting a pending Change item would do to the breaches. */
public record BreachImpactResponse(List<BreachImpact> entering, List<BreachImpact> leaving) {}
