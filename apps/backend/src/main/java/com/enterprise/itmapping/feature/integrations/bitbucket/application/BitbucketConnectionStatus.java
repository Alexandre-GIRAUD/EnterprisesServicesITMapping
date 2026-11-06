package com.enterprise.itmapping.feature.integrations.bitbucket.application;

/** Whether the workspace has a Bitbucket connection. The access token is not included. */
public record BitbucketConnectionStatus(boolean connected, String username) {}
