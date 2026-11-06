package com.enterprise.itmapping.feature.integrations.bitbucket;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Bitbucket Cloud API settings. Calls use the workspace connection; {@code token}
 * (BITBUCKET_TOKEN) is only read to warn at startup that it is ignored.
 */
@ConfigurationProperties(prefix = "app.integrations.bitbucket")
public record BitbucketIntegrationProperties(
    String token, @DefaultValue("https://api.bitbucket.org/2.0") String apiBaseUrl, @DefaultValue("100") int maxRepos) {}
