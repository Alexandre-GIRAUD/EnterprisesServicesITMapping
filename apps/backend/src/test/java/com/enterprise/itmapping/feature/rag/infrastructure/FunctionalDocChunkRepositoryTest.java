package com.enterprise.itmapping.feature.rag.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class FunctionalDocChunkRepositoryTest {

  @Test
  void vectorLiteralUsesUsLocaleDecimals() {
    String lit = FunctionalDocChunkRepository.toVectorLiteral(new float[] {0.1f, -1.5f, 2f});
    assertThat(lit).isEqualTo("[0.10000000,-1.50000000,2.00000000]");
  }
}
