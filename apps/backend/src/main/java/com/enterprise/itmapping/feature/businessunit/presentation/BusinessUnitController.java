package com.enterprise.itmapping.feature.businessunit.presentation;

import com.enterprise.itmapping.domain.BusinessUnit;
import com.enterprise.itmapping.feature.businessunit.application.BusinessUnitService;
import com.enterprise.itmapping.feature.businessunit.infrastructure.persistence.BusinessUnitRepository;
import com.enterprise.itmapping.feature.businessunit.presentation.dto.BusinessUnitCreateRequest;
import com.enterprise.itmapping.feature.businessunit.presentation.dto.BusinessUnitListItemDto;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/business-units")
public class BusinessUnitController {

  private final BusinessUnitRepository businessUnitRepository;
  private final BusinessUnitService businessUnitService;

  public BusinessUnitController(
      BusinessUnitRepository businessUnitRepository, BusinessUnitService businessUnitService) {
    this.businessUnitRepository = businessUnitRepository;
    this.businessUnitService = businessUnitService;
  }

  /**
   * Lists business units for UI filters (id + name only). Does not expose graph nodes for
   * Cytoscape — use {@code GET /graph?businessUnitId=} for filtered application graphs.
   */
  @GetMapping
  public List<BusinessUnitListItemDto> list() {
    return businessUnitRepository.findAllByOrderByNameAsc().stream()
        .map(BusinessUnitController::toListItem)
        .toList();
  }

  /** Creates a {@link BusinessUnit}; id is generated (UUID). */
  @PostMapping
  public ResponseEntity<BusinessUnitListItemDto> create(
      @Valid @RequestBody BusinessUnitCreateRequest request) {
    BusinessUnitListItemDto created = businessUnitService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  private static BusinessUnitListItemDto toListItem(BusinessUnit bu) {
    return new BusinessUnitListItemDto(bu.getId(), bu.getName());
  }
}
