package com.enterprise.itmapping.feature.integrations.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Mirrors GitHub's JSON payload for repositories (subset of fields).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubApiRepoJson(
    @JsonProperty("id") long id,
    @JsonProperty("full_name") String fullName,
    @JsonProperty("name") String name,
    @JsonProperty("description") String description,
    @JsonProperty("html_url") String htmlUrl,
    @JsonProperty("private") boolean isPrivate
) {}
