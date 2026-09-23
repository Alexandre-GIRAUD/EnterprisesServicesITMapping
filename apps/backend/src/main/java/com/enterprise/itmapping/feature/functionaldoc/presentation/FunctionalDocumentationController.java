package com.enterprise.itmapping.feature.functionaldoc.presentation;

import com.enterprise.itmapping.feature.functionaldoc.application.FunctionalDocumentationService;
import com.enterprise.itmapping.feature.functionaldoc.presentation.dto.FunctionalDocumentationResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/applications/{id}/functional-documentation")
public class FunctionalDocumentationController {

  private final FunctionalDocumentationService documentationService;

  public FunctionalDocumentationController(FunctionalDocumentationService documentationService) {
    this.documentationService = documentationService;
  }

  @GetMapping
  public FunctionalDocumentationResponse get(@PathVariable("id") String applicationId) {
    return documentationService.get(applicationId);
  }

  @PostMapping("/generate")
  public ResponseEntity<FunctionalDocumentationResponse> generate(
      @PathVariable("id") String applicationId) {
    FunctionalDocumentationResponse started = documentationService.startGenerate(applicationId);
    return ResponseEntity.status(HttpStatus.ACCEPTED).body(started);
  }
}
