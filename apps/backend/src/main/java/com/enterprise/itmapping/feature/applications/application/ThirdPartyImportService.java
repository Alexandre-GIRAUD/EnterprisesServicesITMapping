package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationDetectionDocumentService.AcceptedDocument;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Creates a non-GitHub application only after its detection document has been accepted. */
@Service
public class ThirdPartyImportService {

  private static final String GITHUB_MARKER = "GitHub:";

  private final ApplicationService applicationService;
  private final ApplicationRepository applicationRepository;
  private final ApplicationDetectionDocumentService documentService;

  public ThirdPartyImportService(
      ApplicationService applicationService,
      ApplicationRepository applicationRepository,
      ApplicationDetectionDocumentService documentService) {
    this.applicationService = applicationService;
    this.applicationRepository = applicationRepository;
    this.documentService = documentService;
  }

  public ApplicationResponse importText(String name, String description, String title, String body) {
    return importAccepted(name, description, documentService.acceptText(title, body));
  }

  public ApplicationResponse importUpload(
      String name, String description, String title, String filename, String contentType, byte[] bytes) {
    return importAccepted(name, description, documentService.acceptUpload(title, filename, contentType, bytes));
  }

  private ApplicationResponse importAccepted(String name, String description, AcceptedDocument accepted) {
    String applicationName = requireThirdPartyName(name);
    requireThirdPartyDescription(description);
    rejectDuplicateName(applicationName);
    ApplicationResponse created =
        applicationService.create(new ApplicationRequest(applicationName, description));
    try {
      documentService.attach(created.id(), accepted);
    } catch (RuntimeException failure) {
      applicationService.delete(created.id());
      throw failure;
    }
    return created;
  }

  private String requireThirdPartyName(String name) {
    if (!StringUtils.hasText(name)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required.");
    }
    String trimmed = name.trim();
    if (trimmed.contains("/")) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Import a name that contains / as a repository.");
    }
    return trimmed;
  }

  private static void requireThirdPartyDescription(String description) {
    if (!StringUtils.hasText(description)) {
      return;
    }
    String trimmed = description.trim();
    if (trimmed.regionMatches(true, 0, GITHUB_MARKER, 0, GITHUB_MARKER.length())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Import a GitHub description as a repository.");
    }
  }

  private void rejectDuplicateName(String name) {
    String wanted = name.toLowerCase(Locale.ROOT);
    boolean exists =
        applicationRepository.findAllForGraph().stream()
            .anyMatch(
                row ->
                    row.getName() != null
                        && row.getName().trim().toLowerCase(Locale.ROOT).equals(wanted));
    if (exists) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "An application with this name already exists.");
    }
  }
}
