package com.enterprise.itmapping.feature.datamodel.domain;

import java.util.List;

/** One user-defined field in the workspace Data Model. */
public record DataModelField(
    String key,
    String label,
    String description,
    String promptHint,
    List<String> allowedValues,
    boolean enforceEnum,
    boolean required) {}
