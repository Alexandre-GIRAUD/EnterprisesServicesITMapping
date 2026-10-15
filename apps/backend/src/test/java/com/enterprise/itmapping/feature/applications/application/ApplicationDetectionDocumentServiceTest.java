package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationDetectionDocumentRepository;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ApplicationDetectionDocumentServiceTest {

  private static final String APP_ID = "third-party";

  @Mock ApplicationRepository applicationRepository;
  @Mock ApplicationDetectionDocumentRepository documentRepository;
  @Mock PdfTextExtractor pdfTextExtractor;

  private ApplicationDetectionDocumentService service;

  @BeforeEach
  void setUp() {
    service =
        new ApplicationDetectionDocumentService(
            applicationRepository, documentRepository, pdfTextExtractor);
    when(applicationRepository.findProjectionById(APP_ID)).thenReturn(Optional.of(projection("Billing")));
  }

  @Test
  void aFailedPdfLeavesThePreviousDocumentInPlace() {
    when(pdfTextExtractor.extract(any()))
        .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unreadable PDF."));

    assertThatThrownBy(() -> service.saveUpload(APP_ID, null, "note.pdf", "application/pdf", new byte[] {1}))
        .isInstanceOf(ResponseStatusException.class);

    verify(documentRepository, never()).save(any());
  }

  @Test
  void refusesADocumentLongerThanTheLimit() {
    String body = "a".repeat(DocumentExcerpt.MAX_CHARACTERS + 1);

    assertThatThrownBy(() -> service.saveText(APP_ID, "Note", body))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining(String.valueOf(DocumentExcerpt.MAX_CHARACTERS));

    verify(documentRepository, never()).save(any());
  }

  private static ApplicationGraphNodeProjection projection(String name) {
    return new ApplicationGraphNodeProjection() {
      @Override
      public String getId() {
        return APP_ID;
      }

      @Override
      public String getName() {
        return name;
      }

      @Override
      public String getDescription() {
        return null;
      }
    };
  }
}
