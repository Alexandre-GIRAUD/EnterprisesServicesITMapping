package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class DocumentExcerptTest {

  @Test
  void matchesASentenceIgnoringExtraWhitespace() {
    String body = "Service B\nexposes an API.";

    assertThat(DocumentExcerpt.contains(body, "Service B exposes an API.")).isTrue();
    assertThat(DocumentExcerpt.matching(body, List.of("Service B exposes an API.", "not in the note")))
        .containsExactly("Service B exposes an API.");
  }

  @Test
  void rejectsAQuoteThatIsNotInTheDocument() {
    assertThat(DocumentExcerpt.contains("Billing owns invoices.", "Service B exposes an API."))
        .isFalse();
    assertThat(DocumentExcerpt.matching("Billing owns invoices.", List.of("Service B exposes an API.")))
        .isEmpty();
  }
}
