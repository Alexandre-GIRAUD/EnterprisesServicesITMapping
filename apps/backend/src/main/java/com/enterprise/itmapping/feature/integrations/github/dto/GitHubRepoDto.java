package com.enterprise.itmapping.feature.integrations.github.dto;

/**
 * Repo summary returned to our frontend ({@code GET /integrations/github/repos}).
 */
public record GitHubRepoDto(
    long id,
    String fullName,
    String name,
    String description,
    String htmlUrl,
    /** {@code true} when the GitHub repository is private. */
    boolean repoPrivate
) {}
