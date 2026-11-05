package com.enterprise.itmapping.feature.breach.presentation.dto;

import com.enterprise.itmapping.feature.breach.application.BreachElement;
import java.util.UUID;

/** One element that would enter or leave breach of one rule. */
public record BreachImpact(UUID ruleId, String ruleName, BreachElement element) {}
