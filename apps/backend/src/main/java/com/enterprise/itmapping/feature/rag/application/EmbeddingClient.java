package com.enterprise.itmapping.feature.rag.application;

import com.enterprise.itmapping.feature.integrations.llm.MappingRagProperties;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingOptions;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.ai.openai.OpenAiEmbeddingOptions;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Thin wrapper around Spring AI {@link EmbeddingModel}. */
@Component
public class EmbeddingClient {

  private static final Logger log = LoggerFactory.getLogger(EmbeddingClient.class);

  private final EmbeddingModel embeddingModel;
  private final MappingRagProperties properties;

  public EmbeddingClient(EmbeddingModel embeddingModel, MappingRagProperties properties) {
    this.embeddingModel = embeddingModel;
    this.properties = properties;
  }

  public float[] embed(String text) {
    return embedAll(List.of(text)).get(0);
  }

  public List<float[]> embedAll(List<String> texts) {
    if (texts == null || texts.isEmpty()) {
      return List.of();
    }
    try {
      EmbeddingOptions options =
          OpenAiEmbeddingOptions.builder().model(properties.embeddingModel()).build();
      EmbeddingResponse response = embeddingModel.call(new EmbeddingRequest(texts, options));
      List<float[]> out = new ArrayList<>(texts.size());
      response
          .getResults()
          .forEach(
              r -> {
                float[] vector = r.getOutput();
                out.add(vector);
              });
      if (out.size() != texts.size()) {
        throw new IllegalStateException(
            "Embedding count mismatch: expected " + texts.size() + " got " + out.size());
      }
      return out;
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      log.error("Embedding failed: {}", e.getMessage());
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "Embedding service unavailable.", e);
    }
  }
}
