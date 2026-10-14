package com.enterprise.itmapping.feature.integrations.github;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuration for server-side GitHub API access. {@code token} is the shared fallback. A signed-in
 * user who connects GitHub uses their own token instead. OAuth client id and secret identify this
 * application, not a person.
 */
@ConfigurationProperties(prefix = "app.integrations.github")
public record GitHubIntegrationProperties(
    String token,
    @DefaultValue("https://api.github.com") String apiBaseUrl,
    @DefaultValue("100") int maxRepos,
    /** HMAC secret for {@code X-Hub-Signature-256} on push webhooks. */
    @DefaultValue("") String webhookSecret,
    /** Branch ref accepted for change detection (default {@code refs/heads/main}). */
    @DefaultValue("refs/heads/main") String webhookBranch,
    @DefaultValue("80") int maxDiffFiles,
    /** Max total patch bytes kept for heuristics (approx KiB × 1024). */
    @DefaultValue("512") int maxDiffKb,
    @DefaultValue("") String clientId,
    @DefaultValue("") String clientSecret,
    @DefaultValue("http://localhost:8081/api/integrations/github/callback") String oauthRedirectUri,
    @DefaultValue("http://localhost:3000/map/import-github") String oauthReturnUrl) {}
