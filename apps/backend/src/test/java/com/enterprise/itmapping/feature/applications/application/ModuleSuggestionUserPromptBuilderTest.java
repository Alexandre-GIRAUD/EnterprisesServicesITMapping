package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ModuleSuggestionUserPromptBuilderTest {

  @Test
  void pathsOnlyOmitsReadmeSection() {
    String out =
        ModuleSuggestionUserPromptBuilder.build(List.of("src/a.ts", "src/b.ts"), null, 50_000);
    assertThat(out).contains("## Repository paths");
    assertThat(out).doesNotContain("## README (context only)");
    assertThat(out).contains("src/a.ts");
  }

  @Test
  void readmeSectionAppendedAfterPaths() {
    String out =
        ModuleSuggestionUserPromptBuilder.build(
            List.of("README.md", "src/x.ts"), "# Title\nHello", 50_000);
    assertThat(out).contains("## Repository paths");
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
    assertThat(out).contains("## Repository paths");
  }

  @Test
  void fileContentsSectionAppendedLastInOrder() {
    Map<String, String> contents = new LinkedHashMap<>();
    contents.put("src/a.ts", "alpha-body");
    contents.put("src/b.ts", "beta-body");

    String out =
        ModuleSuggestionUserPromptBuilder.build(
            List.of("src/a.ts", "src/b.ts"), "# Readme", contents, 50_000);

    assertThat(out).contains("## File contents");
    assertThat(out).contains("=== src/a.ts ===");
    assertThat(out).contains("alpha-body");
    assertThat(out).contains("=== src/b.ts ===");
    int readmeIdx = out.indexOf("## README (context only)");
    int filesIdx = out.indexOf("## File contents");
    int aIdx = out.indexOf("=== src/a.ts ===");
    int bIdx = out.indexOf("=== src/b.ts ===");
    assertThat(filesIdx).isGreaterThan(readmeIdx);
    assertThat(bIdx).isGreaterThan(aIdx);
  }

  @Test
  void fileContentsTruncatedWhenBudgetTooTight() {
    Map<String, String> contents = new LinkedHashMap<>();
    contents.put("src/a.ts", "x".repeat(2000));
    contents.put("src/b.ts", "y".repeat(2000));

    String out =
        ModuleSuggestionUserPromptBuilder.build(List.of("src/a.ts"), null, contents, 1500);

    assertThat(out).contains("## Repository paths");
    assertThat(out).doesNotContain("=== src/b.ts ===");
  }

  @Test
  void emptyFileContentsMatchesPathsOnlyOutput() {
    String withMap =
        ModuleSuggestionUserPromptBuilder.build(List.of("src/a.ts"), "# R", Map.of(), 50_000);
    String legacy = ModuleSuggestionUserPromptBuilder.build(List.of("src/a.ts"), "# R", 50_000);
    assertThat(withMap).isEqualTo(legacy);
    assertThat(withMap).doesNotContain("## File contents");
  }

  @Test
  void initialSelectionPromptContainsPathsAndReadme() {
    String out =
        ModuleSuggestionUserPromptBuilder.buildInitialSelectionPrompt(
            List.of("README.md", "src/a.ts"), "# Title", 50_000);
    assertThat(out).contains("## Repository paths");
    assertThat(out).contains("## README (context only)");
    assertThat(out).contains("src/a.ts");
  }

  @Test
  void followUpSelectionMessageOmitsTreeAndReadmeAndShowsOnlyNewFiles() {
    Map<String, String> newlyFetched = new LinkedHashMap<>();
    newlyFetched.put("src/b.ts", "beta-body");

    String out =
        ModuleSuggestionUserPromptBuilder.buildFollowUpSelectionUserMessage(
            List.of("pom.xml", "src/a.ts"), newlyFetched, 50_000);

    assertThat(out).doesNotContain("## Repository paths");
    assertThat(out).doesNotContain("## README (context only)");
    assertThat(out).contains("## Already read");
    assertThat(out).contains("pom.xml");
    assertThat(out).contains("src/a.ts");
    assertThat(out).contains("## New file contents");
    assertThat(out).contains("=== src/b.ts ===");
    assertThat(out).contains("beta-body");
    assertThat(out).doesNotContain("=== src/a.ts ===");
  }

  @Test
  void followUpSelectionMessageWithoutNewFilesHasNoContentsSection() {
    String out =
        ModuleSuggestionUserPromptBuilder.buildFollowUpSelectionUserMessage(
            List.of("pom.xml"), Map.of(), 50_000);
    assertThat(out).contains("## Already read");
    assertThat(out).contains("pom.xml");
    assertThat(out).doesNotContain("## New file contents");
  }
}
