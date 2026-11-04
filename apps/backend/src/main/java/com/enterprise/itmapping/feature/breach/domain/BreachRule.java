package com.enterprise.itmapping.feature.breach.domain;

import java.util.UUID;

/** A shared rule: elements of {@code subject} for which {@code definition} holds are in breach. */
public record BreachRule(UUID id, String name, BreachSubject subject, BreachDefinition definition) {}
