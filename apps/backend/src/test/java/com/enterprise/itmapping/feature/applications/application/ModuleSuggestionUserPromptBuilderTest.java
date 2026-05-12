package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class ModuleSuggestionUserPromptBuilderTest {

  @Test
  void pathsOnlyOmitsReadmeSection() {
    String out =
        ModuleSuggestionUserPromptBuilder.build(List.of("src/a.ts", "src/b.ts"), null, 50_000);
    assertThat(out).contains("## Repository paths (evidence source)");
    assertThat(out).doesNotContain("## README (context only)");
    assertThat(out).contains("src/a.ts");
  }

  @Test
  void readmeSectionAppendedAfterPaths() {
    String out =
        ModuleSuggestionUserPromptBuilder.build(
            List.of("README.md", "src/x.ts"), "# Title\nHello", 50_000);
    assertThat(out).contains("## Repository paths (evidence source)");
    assertThat(out).contains("## README (context only)");
    assertThat(out).contains("# Title");
    int pathsIdx = out.indexOf("## Repository paths");
    int readmeIdx = out.indexOf("## README (context only)");
    assertThat(readmeIdx).isGreaterThan(pathsIdx);
  }

  @Test
  void dropsReadmeWhenTotalBudgetTooTight() {
    String readme = "x".repeat(5000);
    String out = ModuleSuggestionUserPromptBuilder.build(List.of("a"), readme, 1200);
    assertThat(out).doesNotContain("## README (context only)");
    assertThat(out).contains("## Repository paths (evidence source)");
  }
}
