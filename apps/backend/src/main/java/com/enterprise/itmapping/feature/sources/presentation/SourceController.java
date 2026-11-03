package com.enterprise.itmapping.feature.sources.presentation;

import com.enterprise.itmapping.feature.sources.application.SourceService;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.MappingAlertDto;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.MappingPutRequest;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.MappingResponse;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourceNameDto;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourcePreviewResponse;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourceRequest;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SourceResponse;
import com.enterprise.itmapping.feature.sources.presentation.dto.SourceDtos.SyncResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Data sources that fill Data Model attributes. Reading is open, changing them is admin only. */
@RestController
@RequestMapping("/sources")
public class SourceController {

  private final SourceService service;

  public SourceController(SourceService service) {
    this.service = service;
  }

  @GetMapping
  @PreAuthorize("hasRole('ADMIN')")
  public List<SourceResponse> list() {
    return service.list();
  }

  @GetMapping("/names")
  public List<SourceNameDto> names() {
    return service.listNames();
  }

  @GetMapping("/alerts")
  public List<MappingAlertDto> alerts() {
    return service.alerts();
  }

  @PostMapping
  @PreAuthorize("hasRole('ADMIN')")
  public SourceResponse create(@Valid @RequestBody SourceRequest request) {
    return service.create(request);
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public SourceResponse update(@PathVariable UUID id, @Valid @RequestBody SourceRequest request) {
    return service.update(id, request);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public void delete(@PathVariable UUID id) {
    service.delete(id);
  }

  @PostMapping("/{id}/preview")
  @PreAuthorize("hasRole('ADMIN')")
  public SourcePreviewResponse preview(@PathVariable UUID id) {
    return service.preview(id);
  }

  @GetMapping("/{id}/mapping")
  @PreAuthorize("hasRole('ADMIN')")
  public MappingResponse mapping(@PathVariable UUID id) {
    return service.mapping(id);
  }

  @PutMapping("/{id}/mapping")
  @PreAuthorize("hasRole('ADMIN')")
  public SyncResponse saveMapping(
      @PathVariable UUID id, @Valid @RequestBody MappingPutRequest request) {
    service.saveMapping(id, request.entries());
    return service.sync(id);
  }

  @PostMapping("/{id}/sync")
  @PreAuthorize("hasRole('ADMIN')")
  public SyncResponse sync(@PathVariable UUID id) {
    return service.sync(id);
  }
}
