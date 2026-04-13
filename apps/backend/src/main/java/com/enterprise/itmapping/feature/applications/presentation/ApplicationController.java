package com.enterprise.itmapping.feature.applications.presentation;

import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/applications")
public class ApplicationController {

  private final ApplicationService applicationService;

  public ApplicationController(ApplicationService applicationService) {
    this.applicationService = applicationService;
  }

  @GetMapping
  public List<ApplicationResponse> list(
      @RequestParam(required = false) String validAt
  ) {
    Instant pointInTime = validAt != null ? Instant.parse(validAt) : null;
    return applicationService.findAll(pointInTime);
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApplicationResponse> get(
      @PathVariable String id,
      @RequestParam(required = false) String validAt
  ) {
    Instant pointInTime = validAt != null ? Instant.parse(validAt) : null;
    return applicationService.findById(id, pointInTime)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PostMapping
  public ResponseEntity<ApplicationResponse> create(@Valid @RequestBody ApplicationRequest request) {
    ApplicationResponse created = applicationService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @PutMapping("/{id}")
  public ResponseEntity<ApplicationResponse> update(
      @PathVariable String id,
      @Valid @RequestBody ApplicationRequest request
  ) {
    return applicationService.update(id, request)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PatchMapping("/{id}/soft")
  public ResponseEntity<ApplicationResponse> softUpdate(
      @PathVariable String id,
      @Valid @RequestBody ApplicationRequest request
  ) {
    return applicationService.softUpdate(id, request)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    return applicationService.delete(id)
        ? ResponseEntity.noContent().build()
        : ResponseEntity.notFound().build();
  }
}
