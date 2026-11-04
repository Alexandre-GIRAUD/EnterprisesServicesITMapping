package com.enterprise.itmapping.feature.breach.presentation.dto;

import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import java.time.Instant;
import java.util.UUID;

/** A rule with how many elements are in breach and how many it could not evaluate. */
public record BreachRuleResponse(
    UUID id,
    String name,
    BreachSubject subject,
    BreachDefinition definition,
    int breachCount,
    int unknownCount,
    Instant updatedAt,
    /** Username of the last editor; null when that user was deleted. */
    String updatedBy) {}
