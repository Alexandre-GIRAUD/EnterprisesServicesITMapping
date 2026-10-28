package com.enterprise.itmapping.feature.integrations.github.application;

/** GitHub login and access token for one GitHub connection. */
public record GitHubIdentity(String login, String accessToken) {}
