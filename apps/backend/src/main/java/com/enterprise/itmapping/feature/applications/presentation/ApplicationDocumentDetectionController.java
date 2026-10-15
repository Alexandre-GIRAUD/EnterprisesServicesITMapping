package com.enterprise.itmapping.feature.applications.presentation;

import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionSuggestionService;
import com.enterprise.itmapping.feature.applications.application.ApplicationDetectionDocumentService;
import com.enterprise.itmapping.feature.applications.application.ModuleSuggestionService;
import com.enterprise.itmapping.feature.applications.presentation.dto.DetectionDocumentResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.SaveDetectionDocumentRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/applications")
public class ApplicationDocumentDetectionController {

  private final ApplicationDetectionDocumentService documentService;
  private final ModuleSuggestionService moduleSuggestionService;
  private final ApplicationConnectionSuggestionService connectionSuggestionService;

  public ApplicationDocumentDetectionController(
      ApplicationDetectionDocumentService documentService,
      ModuleSuggestionService moduleSuggestionService,
      ApplicationConnectionSuggestionService connectionSuggestionService) {
    this.documentService = documentService;
    this.moduleSuggestionService = moduleSuggestionService;
    this.connectionSuggestionService = connectionSuggestionService;
  }

  @GetMapping("/{id}/detection-document")
  public DetectionDocumentResponse getDocument(@PathVariable String id) {
    return documentService.view(id);
  }

  @PutMapping("/{id}/detection-document")
  public DetectionDocumentResponse saveText(
      @PathVariable String id, @RequestBody SaveDetectionDocumentRequest body) {
    String title = body != null ? body.title() : null;
    String text = body != null ? body.body() : null;
    return documentService.saveText(id, title, text);
  }

  @PostMapping(value = "/{id}/detection-document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public DetectionDocumentResponse saveFile(
      @PathVariable String id,
      @RequestParam(value = "title", required = false) String title,
      @RequestPart("file") MultipartFile file) {
    try {
      return documentService.saveUpload(
          id, title, file.getOriginalFilename(), file.getContentType(), file.getBytes());
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unreadable file.");
    }
  }

  @PostMapping("/{id}/modules/suggest-from-document")
  public ResponseEntity<SuggestModulesFromGithubResponse> suggestModules(@PathVariable String id) {
    return ResponseEntity.status(HttpStatus.CREATED).body(moduleSuggestionService.suggestFromDocument(id));
  }

  @PostMapping("/{id}/connections/suggest-from-document")
  public ResponseEntity<SuggestConnectionsFromGithubResponse> suggestConnections(@PathVariable String id) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(connectionSuggestionService.suggestFromDocument(id));
  }
}
