package com.enterprise.itmapping.feature.referential.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** One Application as it is named inside one referential. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ReferentialIdentity(String applicationId, String externalKey) {}
