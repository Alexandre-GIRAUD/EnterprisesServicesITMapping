package com.enterprise.itmapping.feature.integrations.github.application;

/** Whether the workspace has a GitHub connection. The access token is not included. */
public record GitHubConnectionStatus(boolean connected, String login) {}
