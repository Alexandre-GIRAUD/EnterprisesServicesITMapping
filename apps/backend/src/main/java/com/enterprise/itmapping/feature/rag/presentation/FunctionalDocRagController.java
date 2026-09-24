package com.enterprise.itmapping.feature.rag.presentation;

import com.enterprise.itmapping.feature.rag.application.FunctionalDocSearchService;
import com.enterprise.itmapping.feature.rag.presentation.dto.FunctionalDocSearchResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/rag")
public class FunctionalDocRagController {

  private final FunctionalDocSearchService searchService;

  public FunctionalDocRagController(FunctionalDocSearchService searchService) {
    this.searchService = searchService;
  }

  /** Debug / QA search without going through the chat LLM. */
  @GetMapping("/search")
  public FunctionalDocSearchResponse search(
      @RequestParam String q,
      @RequestParam(required = false) String applicationId,
      @RequestParam(required = false) Integer k) {
    return searchService.search(q, applicationId, k);
  }
}
