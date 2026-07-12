package com.enterprise.itmapping.feature.integrations.github.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GitHubRepoCloneServiceTest {

  private GitHubRepoCloneService newService() {
    var properties = new GitHubIntegrationProperties("", "https://api.github.com", 100);
    return new GitHubRepoCloneService(new GitHubApiClient(properties));
  }

  @Test
  void deleteQuietlyRemovesNestedWorkspace() throws IOException {
    Path workspace = Files.createTempDirectory("clone-test-");
    Path nested = Files.createDirectories(workspace.resolve("a/b/c"));
    Files.writeString(nested.resolve("file.txt"), "hello");

    newService().deleteQuietly(workspace);

    assertThat(Files.exists(workspace)).isFalse();
  }

  @Test
  void deleteQuietlyIsNullSafe() {
    newService().deleteQuietly(null);
  }

  @Test
  void deleteQuietlyIgnoresMissingWorkspace(@TempDir Path tmp) {
    newService().deleteQuietly(tmp.resolve("does-not-exist"));
  }
}
