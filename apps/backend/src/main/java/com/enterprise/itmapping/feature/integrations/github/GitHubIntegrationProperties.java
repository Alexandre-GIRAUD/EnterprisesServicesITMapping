package com.enterprise.itmapping.feature.integrations.github;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuration for server-side GitHub API access (token via env {@code GITHUB_TOKEN} recommended).
 *
 * <p>For production, prefer injecting a fine-grained or classic PAT rather than exposing tokens to the
 * browser. Full OAuth GitHub login can be layered later (Spring Security) and replace this with
 * user-specific tokens stored server-side after authorization.
 */
@ConfigurationProperties(prefix = "app.integrations.github")
public record GitHubIntegrationProperties(
    /**
     * GitHub PAT or OAuth access token. Never commit real values — use env override.
     */
    String token,
    /**
     * Base URL for the GitHub REST API (default https://api.github.com).
     */
    @DefaultValue("https://api.github.com") String apiBaseUrl,
    /** Max repos to return from the first page (pagination TODO: follow Link header). */
    @DefaultValue("100") int maxRepos
) {}
