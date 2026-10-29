package com.enterprise.itmapping.feature.integrations.bitbucket.dto;

/** Repo summary returned to the frontend ({@code GET /integrations/bitbucket/repos}). */
public record BitbucketRepoDto(
    String id, String fullName, String name, String description, String htmlUrl, boolean repoPrivate) {}
