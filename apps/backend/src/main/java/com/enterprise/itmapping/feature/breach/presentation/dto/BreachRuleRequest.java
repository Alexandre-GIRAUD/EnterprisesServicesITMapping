package com.enterprise.itmapping.feature.breach.presentation.dto;

import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;

/** Body of {@code POST /breach-rules} and {@code PUT /breach-rules/{id}}. */
public record BreachRuleRequest(String name, BreachSubject subject, BreachDefinition definition) {}
