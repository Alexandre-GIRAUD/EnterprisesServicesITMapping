package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationDetectionDocumentEntity;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationDetectionDocumentRepository;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ThirdPartyImportServiceTest {

  @Mock ApplicationService applicationService;
  @Mock ApplicationRepository applicationRepository;
  @Mock ApplicationDetectionDocumentRepository documentRepository;
  @Mock PdfTextExtractor pdfTextExtractor;

  private ThirdPartyImportService service;

  @BeforeEach
  void setUp() {
    ApplicationDetectionDocumentService documents =
        new ApplicationDetectionDocumentService(
            applicationRepository, documentRepository, pdfTextExtractor);
    service = new ThirdPartyImportService(applicationService, applicationRepository, documents);
  }

  @Test
  void aTextNoteCreatesTheApplicationAndStoresTheText() {
    when(applicationRepository.findAllForGraph()).thenReturn(List.of());
    when(applicationService.create(any())).thenReturn(created("app-1", "Billing"));
    when(applicationRepository.findProjectionById("app-1")).thenReturn(Optional.of(projection("app-1", "Billing")));
    when(documentRepository.findByApplicationId("app-1")).thenReturn(Optional.empty());
    when(documentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

    ApplicationResponse created = service.importText("Billing", "Vendor billing", "Note", "Pays invoices.");

    assertThat(created.id()).isEqualTo("app-1");
    ArgumentCaptor<ApplicationDetectionDocumentEntity> stored =
        ArgumentCaptor.forClass(ApplicationDetectionDocumentEntity.class);
    verify(documentRepository).save(stored.capture());
    assertThat(stored.getValue().getBody()).isEqualTo("Pays invoices.");
    assertThat(stored.getValue().getTitle()).isEqualTo("Note");
  }

  @Test
  void aPdfStoresTheExtractedTextLayer() {
    when(applicationRepository.findAllForGraph()).thenReturn(List.of());
    when(pdfTextExtractor.extract(any())).thenReturn("Page one.");
    when(applicationService.create(any())).thenReturn(created("app-1", "Billing"));
    when(applicationRepository.findProjectionById("app-1")).thenReturn(Optional.of(projection("app-1", "Billing")));
    when(documentRepository.findByApplicationId("app-1")).thenReturn(Optional.empty());
    when(documentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

    service.importUpload("Billing", null, null, "vendor.pdf", "application/pdf", new byte[] {1});

    ArgumentCaptor<ApplicationDetectionDocumentEntity> stored =
        ArgumentCaptor.forClass(ApplicationDetectionDocumentEntity.class);
    verify(documentRepository).save(stored.capture());
    assertThat(stored.getValue().getBody()).isEqualTo("Page one.");
    assertThat(stored.getValue().getTitle()).isEqualTo("vendor.pdf");
  }

  @Test
  void aRefusedFileCreatesNoApplication() {
    when(pdfTextExtractor.extract(any()))
        .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unreadable PDF."));

    assertThatThrownBy(
            () -> service.importUpload("Billing", null, null, "scan.pdf", "application/pdf", new byte[] {1}))
        .isInstanceOf(ResponseStatusException.class);

    verify(applicationService, never()).create(any());
  }

  @Test
  void aSlashNameIsRefusedBeforeCreate() {
    assertThatThrownBy(() -> service.importText("acme/billing", null, "Note", "Pays invoices."))
        .isInstanceOf(ResponseStatusException.class);

    verify(applicationService, never()).create(any());
  }

  @Test
  void aGitHubDescriptionIsRefusedBeforeCreate() {
    assertThatThrownBy(
            () -> service.importText("Billing", "GitHub: https://github.com/acme/billing", "Note", "Pays invoices."))
        .isInstanceOf(ResponseStatusException.class);

    verify(applicationService, never()).create(any());
  }

  @Test
  void anExistingNameCreatesNothing() {
    when(applicationRepository.findAllForGraph()).thenReturn(List.of(projection("old", "Billing")));

    assertThatThrownBy(() -> service.importText(" billing ", null, "Note", "Pays invoices."))
        .isInstanceOf(ResponseStatusException.class);

    verify(applicationService, never()).create(any());
    verify(documentRepository, never()).save(any());
  }

  @Test
  void aFailedStoreRemovesTheNewApplication() {
    when(applicationRepository.findAllForGraph()).thenReturn(List.of());
    when(applicationService.create(any())).thenReturn(created("app-1", "Billing"));
    when(applicationRepository.findProjectionById("app-1")).thenReturn(Optional.of(projection("app-1", "Billing")));
    when(documentRepository.save(any())).thenThrow(new IllegalStateException("database"));

    assertThatThrownBy(() -> service.importText("Billing", null, "Note", "Pays invoices."))
        .isInstanceOf(IllegalStateException.class);

    verify(applicationService).delete("app-1");
    verify(applicationService).create(any(ApplicationRequest.class));
  }

  private static ApplicationResponse created(String id, String name) {
    return new ApplicationResponse(id, name, null, false, Map.of());
  }

  private static ApplicationGraphNodeProjection projection(String id, String name) {
    return new ApplicationGraphNodeProjection() {
      @Override
      public String getId() {
        return id;
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
