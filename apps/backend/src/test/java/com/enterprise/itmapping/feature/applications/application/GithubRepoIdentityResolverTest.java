package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
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

  @Test
  void listsEveryRepositoryLinkedToOneApplication() {
    assertThat(
            GithubRepoIdentityResolver.resolveAllFullNames(
                "Checkout",
                """
                GitHub: https://github.com/acme/billing-api
                GitHub: https://github.com/acme/billing-web
                """))
        .containsExactly("acme/billing-api", "acme/billing-web");
  }

  @Test
  void treatsASiblingRepositoryAsInternal() {
    List<String> repos = List.of("acme/billing-api", "acme/billing-web");
    assertThat(GithubRepoIdentityResolver.namesOwnRepository("billing-web", repos)).isTrue();
    assertThat(GithubRepoIdentityResolver.namesOwnRepository("acme/billing-api", repos)).isTrue();
    assertThat(GithubRepoIdentityResolver.namesOwnRepository("Payments", repos)).isFalse();
  }

  @Test
  void findsARepositoryThatIsAlreadyLinked() {
    assertThat(
            GithubRepoIdentityResolver.firstOverlap(
                List.of("acme/billing-web", "acme/ledger"),
                List.of("acme/billing-web")))
        .isEqualTo("acme/billing-web");
    assertThat(GithubRepoIdentityResolver.firstOverlap(List.of("acme/ledger"), List.of("acme/billing-web")))
        .isNull();
  }
}
