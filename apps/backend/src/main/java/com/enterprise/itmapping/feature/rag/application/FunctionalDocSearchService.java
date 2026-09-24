package com.enterprise.itmapping.feature.rag.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.integrations.llm.MappingRagProperties;
import com.enterprise.itmapping.feature.rag.domain.FunctionalDocSearchHit;
import com.enterprise.itmapping.feature.rag.infrastructure.FunctionalDocChunkRepository;
import com.enterprise.itmapping.feature.rag.presentation.dto.FunctionalDocSearchResponse;
import com.enterprise.itmapping.feature.rag.presentation.dto.FunctionalDocSearchResponse.HitDto;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FunctionalDocSearchService {

  private final MappingRagProperties properties;
  private final EmbeddingClient embeddingClient;
  private final FunctionalDocChunkRepository chunkRepository;
  private final ApplicationCatalogQuery catalogQuery;

  public FunctionalDocSearchService(
      MappingRagProperties properties,
      EmbeddingClient embeddingClient,
      FunctionalDocChunkRepository chunkRepository,
      ApplicationCatalogQuery catalogQuery) {
    this.properties = properties;
    this.embeddingClient = embeddingClient;
    this.chunkRepository = chunkRepository;
    this.catalogQuery = catalogQuery;
  }

  public FunctionalDocSearchResponse search(String query, String applicationId, Integer k) {
    if (!properties.enabled()) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "RAG is disabled.");
    }
    if (!StringUtils.hasText(query)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "q is required.");
    }
    int limit = k != null ? Math.min(50, Math.max(1, k)) : properties.topK();
    float[] embedding = embeddingClient.embed(query.trim());
    List<FunctionalDocSearchHit> raw = chunkRepository.search(embedding, applicationId, limit);
    Map<String, String> names = nameById();
    List<HitDto> hits = new ArrayList<>();
    for (FunctionalDocSearchHit hit : raw) {
      if (hit.score() < properties.minScore()) {
        continue;
      }
      hits.add(
          new HitDto(
              hit.applicationId(),
              names.getOrDefault(hit.applicationId(), hit.applicationId()),
              hit.sectionKey(),
              hit.sectionTitle(),
              hit.content(),
              hit.score()));
    }
    return new FunctionalDocSearchResponse(query.trim(), hits, hits.isEmpty() ? "empty" : "ok");
  }

  private Map<String, String> nameById() {
    Map<String, String> map = new HashMap<>();
    for (CatalogRow row : catalogQuery.loadAllNamed()) {
      map.put(row.id(), row.name());
    }
    return map;
  }
}
