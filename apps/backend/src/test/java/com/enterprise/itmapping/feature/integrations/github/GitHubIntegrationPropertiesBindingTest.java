package com.enterprise.itmapping.feature.integrations.github;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class GitHubIntegrationPropertiesBindingTest {

  private final ApplicationContextRunner runner =
      new ApplicationContextRunner().withUserConfiguration(Enable.class);

  @Test
  void bindsTheCanonicalConstructorFromProperties() {
    runner
        .withPropertyValues("app.integrations.github.token=server-token")
        .run(
            context -> {
              assertThat(context).hasNotFailed();
              GitHubIntegrationProperties properties =
                  context.getBean(GitHubIntegrationProperties.class);
              assertThat(properties.token()).isEqualTo("server-token");
              assertThat(properties.apiBaseUrl()).isEqualTo("https://api.github.com");
              assertThat(properties.webhookBranch()).isEqualTo("refs/heads/main");
            });
  }

  @Configuration
  @EnableConfigurationProperties(GitHubIntegrationProperties.class)
  static class Enable {}
}
