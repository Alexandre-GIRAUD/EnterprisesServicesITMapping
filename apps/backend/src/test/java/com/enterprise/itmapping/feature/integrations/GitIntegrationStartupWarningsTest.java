package com.enterprise.itmapping.feature.integrations;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class GitIntegrationStartupWarningsTest {

  @Test
  void serverWideGitSettingsAreReportedAsIgnoredOrLegacy() {
    List<String> warnings =
        GitIntegrationStartupWarnings.warningsFor("a-token", "a-token", "a-secret");

    assertThat(warnings)
        .anyMatch(line -> line.contains("GITHUB_TOKEN is ignored"))
        .anyMatch(line -> line.contains("BITBUCKET_TOKEN is ignored"))
        .anyMatch(line -> line.contains("GITHUB_WEBHOOK_SECRET"));
  }

  @Test
  void nothingToSayWhenTheyAreUnset() {
    assertThat(GitIntegrationStartupWarnings.warningsFor("", null, " ")).isEmpty();
  }
}
