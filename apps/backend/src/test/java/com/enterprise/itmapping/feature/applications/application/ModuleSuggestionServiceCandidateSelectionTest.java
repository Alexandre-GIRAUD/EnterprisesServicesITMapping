package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Validation rules of the Pass-1 file-selection candidate filtering. */
class ModuleSuggestionServiceCandidateSelectionTest {

  private static final Set<String> TREE =
      new LinkedHashSet<>(List.of("pom.xml", "src/a.ts", "src/b.ts", "src/c.ts"));

  @Test
  void dropsPathsOutsideTreeAndNormalizes() {
    List<String> out =
        ModuleSuggestionService.selectCandidatePaths(
            List.of("/src/a.ts", "does/not/exist.ts", "pom.xml"), TREE, Set.of(), 10, 25);
    assertThat(out).containsExactly("src/a.ts", "pom.xml");
  }

  @Test
  void respectsPerIterationCap() {
    List<String> out =
        ModuleSuggestionService.selectCandidatePaths(
            List.of("pom.xml", "src/a.ts", "src/b.ts", "src/c.ts"), TREE, Set.of(), 2, 25);
    assertThat(out).containsExactly("pom.xml", "src/a.ts");
  }

  @Test
  void skipsAlreadyReadAndDeduplicates() {
    List<String> out =
        ModuleSuggestionService.selectCandidatePaths(
            List.of("src/a.ts", "src/b.ts", "src/b.ts"), TREE, Set.of("src/a.ts"), 10, 25);
    assertThat(out).containsExactly("src/b.ts");
  }

  @Test
  void returnsEmptyWhenTotalBudgetExhausted() {
    List<String> out =
        ModuleSuggestionService.selectCandidatePaths(
            List.of("src/a.ts"), TREE, Set.of("pom.xml", "src/c.ts"), 10, 2);
    assertThat(out).isEmpty();
  }
}
