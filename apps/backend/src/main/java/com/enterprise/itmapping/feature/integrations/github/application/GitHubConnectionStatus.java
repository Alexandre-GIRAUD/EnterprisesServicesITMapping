package com.enterprise.itmapping.feature.integrations.github.application;

/** Whether the signed-in user has connected GitHub. The access token is not included. */
public record GitHubConnectionStatus(boolean connected, String login) {}
