package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ModuleSuggestionEvidenceValidatorTest {

  @Test
  void emptyEvidenceFails() {
    assertThat(
            ModuleSuggestionEvidenceValidator.allEvidenceMatches(
                List.of(), Set.of("src/a")))
        .isFalse();
  }

  @Test
  void matchesExactKnownPath() {
    assertThat(
            ModuleSuggestionEvidenceValidator.allEvidenceMatches(
                List.of("/src/Main.java"), Set.of("src/Main.java")))
        .isTrue();
  }

  @Test
  void matchesViaDirectoryPrefixUnderKnownPath() {
    assertThat(
            ModuleSuggestionEvidenceValidator.evidenceMatchesOne(
                "src/services", Set.of("src/services/payments/impl.java")))
        .isTrue();
  }

  @Test
  void rejectsUnknownPath() {
    assertThat(
            ModuleSuggestionEvidenceValidator.allEvidenceMatches(
                List.of("made/up/path.rb"), Set.of("src/foo.java")))
        .isFalse();
  }
}
