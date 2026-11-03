package com.enterprise.itmapping.feature.referential.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** A dot path in the referential response that fills one NODE attribute. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ReferentialMapping(String path, String fieldKey) {}
