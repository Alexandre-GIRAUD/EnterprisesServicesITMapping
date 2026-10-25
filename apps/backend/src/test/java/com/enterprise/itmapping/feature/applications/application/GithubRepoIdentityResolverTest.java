package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GithubRepoIdentityResolverTest {

  @Test
  void findsOwnerAndRepoWhenTheGitHubUrlIsNotTheWholeDescription() {
    assertThat(
            GithubRepoIdentityResolver.resolveFullName(
                "Hello-World",
                "Says hello\nGitHub: https://github.com/octocat/Hello-World",
                null))
        .contains("octocat/Hello-World");
  }
}
