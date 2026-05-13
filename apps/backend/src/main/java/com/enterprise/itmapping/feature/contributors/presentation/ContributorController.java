package com.enterprise.itmapping.feature.contributors.presentation;

import com.enterprise.itmapping.feature.contributors.application.ContributorService;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorDetailResponse;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorListItemDto;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorWriteRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/contributors")
public class ContributorController {

  private final ContributorService contributorService;

  public ContributorController(ContributorService contributorService) {
    this.contributorService = contributorService;
  }

  @GetMapping
  public List<ContributorListItemDto> list() {
    return contributorService.findAll();
  }

  @GetMapping("/{id}")
  public ResponseEntity<ContributorDetailResponse> get(@PathVariable String id) {
    return contributorService
        .findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PostMapping
  public ResponseEntity<ContributorDetailResponse> create(
      @Valid @RequestBody ContributorWriteRequest request) {
    ContributorDetailResponse created = contributorService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @PutMapping("/{id}")
  public ResponseEntity<ContributorDetailResponse> update(
      @PathVariable String id, @Valid @RequestBody ContributorWriteRequest request) {
    return contributorService
        .update(id, request)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    return contributorService.delete(id)
        ? ResponseEntity.noContent().build()
        : ResponseEntity.notFound().build();
  }
}
