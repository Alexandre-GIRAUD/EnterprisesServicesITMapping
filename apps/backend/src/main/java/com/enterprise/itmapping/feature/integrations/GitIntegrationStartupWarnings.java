package com.enterprise.itmapping.feature.integrations;

import com.enterprise.itmapping.feature.integrations.bitbucket.BitbucketIntegrationProperties;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Server-wide Git settings from before workspace connections: tokens are ignored, the global
 * webhook secret only serves the Default workspace. Warns instead of failing, so upgrades boot.
 */
@Component
public class GitIntegrationStartupWarnings {

  private static final Logger log = LoggerFactory.getLogger(GitIntegrationStartupWarnings.class);

  public GitIntegrationStartupWarnings(
      GitHubIntegrationProperties github, BitbucketIntegrationProperties bitbucket) {
    collectWarnings(github.token(), bitbucket.token(), github.webhookSecret()).forEach(log::warn);
  }

  static List<String> collectWarnings(
      String gitHubToken, String bitbucketToken, String gitHubWebhookSecret) {
    List<String> warnings = new ArrayList<>();
    if (StringUtils.hasText(gitHubToken)) {
      warnings.add(
          "GITHUB_TOKEN is ignored: each workspace admin connects GitHub in Settings.");
    }
    if (StringUtils.hasText(bitbucketToken)) {
      warnings.add(
          "BITBUCKET_TOKEN is ignored: each workspace admin connects Bitbucket in Settings.");
    }
    if (StringUtils.hasText(gitHubWebhookSecret)) {
      warnings.add(
          "GITHUB_WEBHOOK_SECRET only serves the legacy /api/webhooks/github URL of the Default"
              + " workspace: use the workspace webhook URL shown in Settings.");
    }
    return warnings;
  }
}
