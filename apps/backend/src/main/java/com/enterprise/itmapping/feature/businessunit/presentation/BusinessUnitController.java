package com.enterprise.itmapping.feature.businessunit.presentation;

import com.enterprise.itmapping.domain.BusinessUnit;
import com.enterprise.itmapping.feature.businessunit.infrastructure.persistence.BusinessUnitRepository;
import com.enterprise.itmapping.feature.businessunit.presentation.dto.BusinessUnitListItemDto;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/business-units")
public class BusinessUnitController {

  private final BusinessUnitRepository businessUnitRepository;

  public BusinessUnitController(BusinessUnitRepository businessUnitRepository) {
    this.businessUnitRepository = businessUnitRepository;
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

  private static BusinessUnitListItemDto toListItem(BusinessUnit bu) {
    return new BusinessUnitListItemDto(bu.getId(), bu.getName());
  }
}
