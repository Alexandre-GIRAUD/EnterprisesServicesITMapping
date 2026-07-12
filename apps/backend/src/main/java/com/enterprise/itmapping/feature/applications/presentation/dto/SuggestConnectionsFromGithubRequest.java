package com.enterprise.itmapping.feature.applications.presentation.dto;

/** Optional body for {@code POST /applications/{id}/connections/suggest-from-github}. */
public record SuggestConnectionsFromGithubRequest(
    /** Overrides owner/repo when the application {@code name} is not {@code login/repo}. */
    String fullName) {}
