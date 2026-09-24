package com.enterprise.itmapping.feature.rag.presentation;

import com.enterprise.itmapping.feature.rag.application.FunctionalDocIndexer;
import com.enterprise.itmapping.feature.rag.presentation.dto.RagReindexResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/rag")
@PreAuthorize("hasRole('ADMIN')")
public class AdminRagController {

  private final FunctionalDocIndexer indexer;

  public AdminRagController(FunctionalDocIndexer indexer) {
    this.indexer = indexer;
  }

  @PostMapping("/reindex")
  public RagReindexResponse reindexAll() {
    int n = indexer.reindexAllReady();
    return new RagReindexResponse(n, "Reindexed READY functional docs.");
  }

  @PostMapping("/reindex/{applicationId}")
  public RagReindexResponse reindexOne(@PathVariable String applicationId) {
    indexer.reindex(applicationId);
    return new RagReindexResponse(1, "Reindexed application " + applicationId);
  }
}
