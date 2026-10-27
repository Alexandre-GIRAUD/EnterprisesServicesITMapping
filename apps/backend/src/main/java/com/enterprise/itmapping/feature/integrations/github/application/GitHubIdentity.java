package com.enterprise.itmapping.feature.integrations.github.application;

/** GitHub login and the access token the user pasted. */
public record GitHubIdentity(String login, String accessToken) {}
