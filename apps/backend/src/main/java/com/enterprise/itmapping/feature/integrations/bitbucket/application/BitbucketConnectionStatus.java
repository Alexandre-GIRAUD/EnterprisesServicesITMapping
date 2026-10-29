package com.enterprise.itmapping.feature.integrations.bitbucket.application;

/** Whether the signed-in user has connected Bitbucket. The access token is not included. */
public record BitbucketConnectionStatus(boolean connected, String username) {}
