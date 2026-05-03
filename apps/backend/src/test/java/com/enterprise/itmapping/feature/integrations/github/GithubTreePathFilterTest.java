package com.enterprise.itmapping.feature.integrations.github;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class GithubTreePathFilterTest {

  @Test
  void excludesNodeModulesSegments() {
    assertThat(GithubTreePathFilter.shouldExcludePath("apps/web/node_modules/foo.js", 14))
        .isTrue();
    assertThat(GithubTreePathFilter.shouldExcludePath("apps/web/src/main.ts", 14)).isFalse();
  }

  @Test
  void excludesByDepth() {
    List<String> parts = List.of("a", "b", "c", "d", "e");
    String deep = String.join("/", parts);
    assertThat(GithubTreePathFilter.shouldExcludePath(deep, 4)).isTrue();
    assertThat(GithubTreePathFilter.shouldExcludePath("a/b/c", 4)).isFalse();
  }

  @Test
  void excludesBinaryExtension() {
    assertThat(GithubTreePathFilter.shouldExcludePath("static/logo.PNG", 14)).isTrue();
    assertThat(GithubTreePathFilter.shouldExcludePath("src/App.tsx", 14)).isFalse();
  }

  @Test
  void normalizePathTrimsLeadingSlashesAndBackslashes() {
    assertThat(GithubTreePathFilter.normalizePath("\\dist\\bundle.js")).isEqualTo("dist/bundle.js");
    assertThat(GithubTreePathFilter.normalizePath("/src/main")).isEqualTo("src/main");
  }

  @Test
  void filterAndCapPreservesOrderWithinLimit() {
    List<String> in =
        List.of(
            "src/a.ts",
            "node_modules/x",
            "src/b.ts",
            "coverage/lcov.info",
            "README.md");
    List<String> out =
        GithubTreePathFilter.filterAndCap(in, GithubTreePathFilter.DEFAULT_MAX_DEPTH, 100);
    assertThat(out).containsExactly("src/a.ts", "src/b.ts", "README.md");
  }

  @Test
  void prioritizeMonorepoRoots() {
    List<String> in = List.of("README.md", "apps/web/index.ts", "legacy/foo.bar", "packages/core/x");
    List<String> out = GithubTreePathFilter.prioritizeMonorepoRoots(in);
    assertThat(out.subList(0, 2)).containsExactlyInAnyOrder("apps/web/index.ts", "packages/core/x");
    assertThat(out).endsWith("README.md", "legacy/foo.bar");
  }
}
