package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BitbucketRepoIdentityResolverTest {

  @Test
  void findsWorkspaceAndRepoFromABitbucketUrl() {
    assertThat(
            BitbucketRepoIdentityResolver.resolveAllFullNames(
                "billing",
                "Says hello\nBitbucket: https://bitbucket.org/acme/billing-api"))
        .containsExactly("acme/billing-api");
  }

  @Test
  void ignoresAGitHubUrl() {
    assertThat(
            BitbucketRepoIdentityResolver.resolveAllFullNames(
                "billing", "GitHub: https://github.com/acme/billing-api"))
        .isEmpty();
  }
}
