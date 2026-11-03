package com.enterprise.itmapping.feature.referential.presentation;

import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.ProbeResult;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.SyncResult;
import com.enterprise.itmapping.feature.referential.application.ReferentialResponses.View;
import com.enterprise.itmapping.feature.referential.application.ReferentialService;
import com.enterprise.itmapping.feature.referential.domain.ReferentialIdentity;
import com.enterprise.itmapping.feature.referential.domain.ReferentialMapping;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/referentials")
public class ReferentialController {

  private final ReferentialService referentialService;

  public ReferentialController(ReferentialService referentialService) {
    this.referentialService = referentialService;
  }

  @GetMapping
  public List<View> list() {
    return referentialService.list();
  }

  @PostMapping
  @PreAuthorize("hasRole('ADMIN')")
  public View create(@RequestBody WriteRequest request) {
    return referentialService.create(request.name(), request.urlTemplate(), request.headerName());
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public View update(@PathVariable UUID id, @RequestBody WriteRequest request) {
    return referentialService.update(id, request.name(), request.urlTemplate(), request.headerName());
  }

  @PutMapping("/{id}/secret")
  @PreAuthorize("hasRole('ADMIN')")
  public View setSecret(@PathVariable UUID id, @RequestBody SecretRequest request) {
    return referentialService.setSecret(id, request.secret());
  }

  @PutMapping("/{id}/identities")
  @PreAuthorize("hasRole('ADMIN')")
  public View replaceIdentities(@PathVariable UUID id, @RequestBody IdentitiesRequest request) {
    return referentialService.replaceIdentities(id, request.identities());
  }

  @PutMapping("/{id}/mappings")
  @PreAuthorize("hasRole('ADMIN')")
  public View replaceMappings(@PathVariable UUID id, @RequestBody MappingsRequest request) {
    return referentialService.replaceMappings(id, request.mappings());
  }

  @PostMapping("/bind")
  @PreAuthorize("hasRole('ADMIN')")
  public List<View> bind(@RequestBody BindRequest request) {
    return referentialService.bind(request.fieldKey(), parseId(request.referentialId()), request.path());
  }

  @PostMapping("/{id}/probe")
  @PreAuthorize("hasRole('ADMIN')")
  public ProbeResult probe(@PathVariable UUID id, @RequestBody ProbeRequest request) {
    return referentialService.probe(id, request.applicationId());
  }

  @PostMapping("/{id}/propose")
  @PreAuthorize("hasRole('ADMIN')")
  public List<ReferentialMapping> propose(@PathVariable UUID id) {
    return referentialService.propose(id);
  }

  @PostMapping("/{id}/sync")
  @PreAuthorize("hasRole('ADMIN')")
  public SyncResult sync(@PathVariable UUID id, @RequestBody(required = false) SyncRequest request) {
    String applicationId = request == null ? null : request.applicationId();
    return referentialService.sync(id, applicationId);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    referentialService.delete(id);
  }

  private static UUID parseId(String referentialId) {
    if (referentialId == null || referentialId.isBlank()) {
      return null;
    }
    try {
      return UUID.fromString(referentialId.trim());
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Referential id is invalid.");
    }
  }

  public record WriteRequest(String name, String urlTemplate, String headerName) {}

  public record SecretRequest(String secret) {}

  public record IdentitiesRequest(List<ReferentialIdentity> identities) {}

  public record MappingsRequest(List<ReferentialMapping> mappings) {}

  public record BindRequest(String fieldKey, String referentialId, String path) {}

  public record ProbeRequest(String applicationId) {}

  public record SyncRequest(String applicationId) {}
}
