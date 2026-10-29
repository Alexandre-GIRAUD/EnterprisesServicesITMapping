package com.enterprise.itmapping.feature.integrations.bitbucket;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Server-side Bitbucket Cloud access. {@code token} is the shared fallback. A signed-in user with a
 * Bitbucket connection uses their token instead.
 */
@ConfigurationProperties(prefix = "app.integrations.bitbucket")
public record BitbucketIntegrationProperties(
    String token, @DefaultValue("https://api.bitbucket.org/2.0") String apiBaseUrl, @DefaultValue("100") int maxRepos) {}
