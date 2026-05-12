package com.enterprise.itmapping.feature.integrations.github.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class GitHubRootReadmePathSelectorTest {

  @Test
  void selectsNothingWhenNoRootReadme() {
    assertThat(GitHubRootReadmePathSelector.selectRootReadmePath(Set.of("src/Main.java", "docs/README.md")))
        .isEmpty();
  }

  @Test
  void prefersReadmeMdOverReadmeMdLowercaseWhenBothPresent() {
    Set<String> paths = new LinkedHashSet<>();
    paths.add("readme.md");
    paths.add("README.md");
    assertThat(GitHubRootReadmePathSelector.selectRootReadmePath(paths)).contains("README.md");
  }

  @Test
  void selectsSingleRootReadme() {
    assertThat(GitHubRootReadmePathSelector.selectRootReadmePath(Set.of("apps/foo", "README.md")))
        .contains("README.md");
  }

  @Test
  void readmeMarkdownAccepted() {
    assertThat(GitHubRootReadmePathSelector.selectRootReadmePath(Set.of("README.markdown"))).contains("README.markdown");
  }
}
