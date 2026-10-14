package com.enterprise.itmapping.feature.integrations.github.application;

/** GitHub login and access token returned by the OAuth code exchange. */
public record GitHubIdentity(String login, String accessToken) {}
