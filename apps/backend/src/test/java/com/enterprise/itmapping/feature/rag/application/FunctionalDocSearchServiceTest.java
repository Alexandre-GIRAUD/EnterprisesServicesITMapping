package com.enterprise.itmapping.feature.rag.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.integrations.llm.MappingRagProperties;
import com.enterprise.itmapping.feature.rag.domain.FunctionalDocSearchHit;
import com.enterprise.itmapping.feature.rag.infrastructure.FunctionalDocChunkRepository;
import com.enterprise.itmapping.feature.rag.presentation.dto.FunctionalDocSearchResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FunctionalDocSearchServiceTest {

  @Mock MappingRagProperties properties;
  @Mock EmbeddingClient embeddingClient;
  @Mock FunctionalDocChunkRepository chunkRepository;
  @Mock ApplicationCatalogQuery catalogQuery;

  @InjectMocks FunctionalDocSearchService service;

  @Test
  void filtersBelowMinScore() {
    when(properties.enabled()).thenReturn(true);
    when(properties.topK()).thenReturn(8);
    when(properties.minScore()).thenReturn(0.5);
    when(embeddingClient.embed("payments")).thenReturn(new float[] {0.1f, 0.2f});
    when(chunkRepository.search(any(), isNull(), eq(8)))
        .thenReturn(
            List.of(
                new FunctionalDocSearchHit(
                    "a1", null, "capability", "Pay", "content", 0.9),
                new FunctionalDocSearchHit(
                    "a2", null, "capability", "Other", "content", 0.2)));
    when(catalogQuery.loadAllNamed()).thenReturn(List.of(new CatalogRow("a1", "Billing", null)));

    FunctionalDocSearchResponse res = service.search("payments", null, null);

    assertThat(res.hits()).hasSize(1);
    assertThat(res.hits().get(0).applicationName()).isEqualTo("Billing");
    assertThat(res.note()).isEqualTo("ok");
  }
}
