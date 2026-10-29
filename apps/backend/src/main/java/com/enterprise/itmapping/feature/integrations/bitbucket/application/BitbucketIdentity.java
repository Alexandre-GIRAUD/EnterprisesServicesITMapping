package com.enterprise.itmapping.feature.integrations.bitbucket.application;

/** Bitbucket username for a token that Bitbucket accepted. The token is not logged. */
public record BitbucketIdentity(String username, String accessToken) {}
