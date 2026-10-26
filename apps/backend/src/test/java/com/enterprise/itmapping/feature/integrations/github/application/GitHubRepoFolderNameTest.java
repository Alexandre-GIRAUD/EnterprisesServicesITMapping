package com.enterprise.itmapping.feature.integrations.github.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class GitHubRepoFolderNameTest {

  @Test
  void usesTheRepoNameUntilTwoRepositoriesShareIt() {
    Set<String> taken = new HashSet<>();
    assertThat(GitHubRepoCloneService.folderName("acme/billing-api", taken)).isEqualTo("billing-api");
    assertThat(GitHubRepoCloneService.folderName("other/billing-api", taken)).isEqualTo("other-billing-api");
  }
}
