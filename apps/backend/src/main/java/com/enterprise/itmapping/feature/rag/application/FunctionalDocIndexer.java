package com.enterprise.itmapping.feature.rag.application;

import com.enterprise.itmapping.feature.functionaldoc.domain.FunctionalDocStatus;
import com.enterprise.itmapping.feature.functionaldoc.infrastructure.persistence.ApplicationFunctionalDocEntity;
import com.enterprise.itmapping.feature.functionaldoc.infrastructure.persistence.ApplicationFunctionalDocRepository;
import com.enterprise.itmapping.feature.integrations.llm.MappingRagProperties;
import com.enterprise.itmapping.feature.rag.domain.DocChunkDraft;
import com.enterprise.itmapping.feature.rag.infrastructure.FunctionalDocChunkRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Indexes READY functional docs into pgvector chunks. */
@Service
public class FunctionalDocIndexer {

  private static final Logger log = LoggerFactory.getLogger(FunctionalDocIndexer.class);

  private final MappingRagProperties properties;
  private final ApplicationFunctionalDocRepository docRepository;
  private final FunctionalDocChunker chunker;
  private final EmbeddingClient embeddingClient;
  private final FunctionalDocChunkRepository chunkRepository;

  public FunctionalDocIndexer(
      MappingRagProperties properties,
      ApplicationFunctionalDocRepository docRepository,
      FunctionalDocChunker chunker,
      EmbeddingClient embeddingClient,
      FunctionalDocChunkRepository chunkRepository) {
    this.properties = properties;
    this.docRepository = docRepository;
    this.chunker = chunker;
    this.embeddingClient = embeddingClient;
    this.chunkRepository = chunkRepository;
  }

  @Transactional
  public void reindex(String applicationId) {
    if (!properties.enabled() || !properties.reindexOnReady()) {
      return;
    }
    ApplicationFunctionalDocEntity entity =
        docRepository.findByApplicationId(applicationId).orElse(null);
    if (entity == null || entity.getStatus() != FunctionalDocStatus.READY) {
      deleteByApplicationId(applicationId);
      return;
    }
    UUID docId = entity.getId();
    List<DocChunkDraft> drafts = chunker.chunk(entity.getPayload(), entity.getMarkdownCache());
    if (drafts.isEmpty()) {
      chunkRepository.deleteByDocId(docId);
      log.info("RAG reindex cleared empty chunks applicationId={}", applicationId);
      return;
    }

    Set<String> existingHashes = chunkRepository.findContentHashesByDocId(docId);
    Set<String> newHashes = new HashSet<>();
    for (DocChunkDraft d : drafts) {
      newHashes.add(d.contentHash());
    }
    if (existingHashes.equals(newHashes)
        && chunkRepository.countByDocId(docId) == drafts.size()) {
      log.debug("RAG reindex skipped (unchanged hashes) applicationId={}", applicationId);
      return;
    }

    List<float[]> embeddings =
        embeddingClient.embedAll(drafts.stream().map(DocChunkDraft::content).toList());
    chunkRepository.deleteByDocId(docId);
    chunkRepository.insertAll(applicationId, docId, drafts, embeddings);
    log.info(
        "RAG reindex done applicationId={} chunks={}", applicationId, drafts.size());
  }

  @Transactional
  public void deleteByApplicationId(String applicationId) {
    chunkRepository.deleteByApplicationId(applicationId);
  }

  @Transactional
  public int reindexAllReady() {
    if (!properties.enabled()) {
      return 0;
    }
    int n = 0;
    for (ApplicationFunctionalDocEntity entity :
        docRepository.findAll().stream()
            .filter(e -> e.getStatus() == FunctionalDocStatus.READY)
            .toList()) {
      reindex(entity.getApplicationId());
      n++;
    }
    return n;
  }
}
