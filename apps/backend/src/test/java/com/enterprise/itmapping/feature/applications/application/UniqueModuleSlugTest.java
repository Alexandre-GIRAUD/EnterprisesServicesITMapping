package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class UniqueModuleSlugTest {

  @Test
  void prefixesADuplicateSlugWithItsRepositoryFolder() {
    assertThat(ModuleSuggestionService.uniqueModuleSlug("orders", List.of("billing-api/src/Orders.java"), Set.of("orders")))
        .isEqualTo("billing-api-orders");
    assertThat(ModuleSuggestionService.uniqueModuleSlug("orders", List.of("Orders.java"), Set.of("orders")))
        .isNull();
  }
}
