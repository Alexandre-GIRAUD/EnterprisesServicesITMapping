package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationDetectionDocumentEntity;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationDetectionDocumentRepository;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.DetectionDocumentResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** One current detection document per application. A failed save does not replace it. */
@Service
public class ApplicationDetectionDocumentService {

  public record StoredDocument(String title, String body, Instant updatedAt) {}

  /** Text that passed the document rules and is ready to store. */
  public record AcceptedDocument(String title, String body) {}

  private final ApplicationRepository applicationRepository;
  private final ApplicationDetectionDocumentRepository documentRepository;
  private final PdfTextExtractor pdfTextExtractor;

  public ApplicationDetectionDocumentService(
      ApplicationRepository applicationRepository,
      ApplicationDetectionDocumentRepository documentRepository,
      PdfTextExtractor pdfTextExtractor) {
    this.applicationRepository = applicationRepository;
    this.documentRepository = documentRepository;
    this.pdfTextExtractor = pdfTextExtractor;
  }

  @Transactional(readOnly = true)
  public DetectionDocumentResponse view(String applicationId) {
    requireWritableApplication(applicationId);
    return find(applicationId)
        .map(ApplicationDetectionDocumentService::toResponse)
        .orElseGet(DetectionDocumentResponse::empty);
  }

  @Transactional(readOnly = true)
  public StoredDocument require(String applicationId) {
    return find(applicationId)
        .orElseThrow(
            () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add a document first."));
  }

  public AcceptedDocument acceptText(String title, String body) {
    return accept(resolveTitle(title, null), body);
  }

  public AcceptedDocument acceptUpload(
      String title, String filename, String contentType, byte[] bytes) {
    return accept(resolveTitle(title, filename), readUpload(filename, contentType, bytes));
  }

  @Transactional
  public DetectionDocumentResponse attach(String applicationId, AcceptedDocument accepted) {
    requireWritableApplication(applicationId);
    return toResponse(store(applicationId, accepted.title(), accepted.body()));
  }

  @Transactional
  public DetectionDocumentResponse saveText(String applicationId, String title, String body) {
    requireWritableApplication(applicationId);
    return toResponse(store(applicationId, resolveTitle(title, null), body));
  }

  @Transactional
  public DetectionDocumentResponse saveUpload(
      String applicationId, String title, String filename, String contentType, byte[] bytes) {
    requireWritableApplication(applicationId);
    String body = readUpload(filename, contentType, bytes);
    return toResponse(store(applicationId, resolveTitle(title, filename), body));
  }

  private Optional<StoredDocument> find(String applicationId) {
    return documentRepository
        .findByApplicationId(applicationId)
        .map(row -> new StoredDocument(row.getTitle(), row.getBody(), row.getUpdatedAt()));
  }

  private AcceptedDocument accept(String title, String body) {
    if (body == null || body.trim().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Document is empty.");
    }
    if (body.length() > DocumentExcerpt.MAX_CHARACTERS) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Document exceeds " + DocumentExcerpt.MAX_CHARACTERS + " characters.");
    }
    return new AcceptedDocument(title, body);
  }

  private StoredDocument store(String applicationId, String title, String body) {
    accept(title, body);
    ApplicationDetectionDocumentEntity entity =
        documentRepository
            .findByApplicationId(applicationId)
            .orElseGet(
                () -> {
                  ApplicationDetectionDocumentEntity created = new ApplicationDetectionDocumentEntity();
                  created.setApplicationId(applicationId);
                  return created;
                });
    entity.setTitle(title);
    entity.setBody(body);
    entity.setUpdatedAt(Instant.now());
    ApplicationDetectionDocumentEntity saved = documentRepository.save(entity);
    return new StoredDocument(saved.getTitle(), saved.getBody(), saved.getUpdatedAt());
  }

  private void requireWritableApplication(String applicationId) {
    var app =
        applicationRepository
            .findProjectionById(applicationId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Application introuvable: " + applicationId));
    if (GithubRepoIdentityResolver.resolveFullName(app.getName(), app.getDescription(), null)
        .isPresent()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "This application is linked to GitHub.");
    }
  }

  private String readUpload(String filename, String contentType, byte[] bytes) {
    String name = filename == null ? "" : filename.trim().toLowerCase(Locale.ROOT);
    String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
    if (name.endsWith(".pdf") || type.contains("application/pdf")) {
      return pdfTextExtractor.extract(bytes);
    }
    if (name.endsWith(".txt") || name.endsWith(".md") || type.startsWith("text/")) {
      return new String(bytes == null ? new byte[0] : bytes, StandardCharsets.UTF_8);
    }
    throw new ResponseStatusException(
        HttpStatus.BAD_REQUEST, "Only text and PDF files are accepted.");
  }

  private static String resolveTitle(String title, String filename) {
    if (StringUtils.hasText(title)) {
      return trimTitle(title.trim());
    }
    if (StringUtils.hasText(filename)) {
      String base = filename.trim().replace('\\', '/');
      int slash = base.lastIndexOf('/');
      if (slash >= 0) {
        base = base.substring(slash + 1);
      }
      if (StringUtils.hasText(base)) {
        return trimTitle(base);
      }
    }
    return "Documentation";
  }

  private static String trimTitle(String title) {
    return title.length() <= 255 ? title : title.substring(0, 255);
  }

  private static DetectionDocumentResponse toResponse(StoredDocument document) {
    return new DetectionDocumentResponse(
        document.title(),
        document.body(),
        document.body() == null ? 0 : document.body().length(),
        document.updatedAt());
  }
}
