package com.enterprise.itmapping.feature.region.presentation;

import com.enterprise.itmapping.feature.applications.presentation.dto.RegionSummary;
import com.enterprise.itmapping.feature.region.infrastructure.persistence.RegionRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only catalogue for UI (no CRUD Region in v1). */
@RestController
@RequestMapping("/regions")
public class RegionController {

  private final RegionRepository regionRepository;

  public RegionController(RegionRepository regionRepository) {
    this.regionRepository = regionRepository;
  }

  @GetMapping
  public List<RegionSummary> list() {
    return regionRepository.findAllByOrderByCodeAsc().stream()
        .map(
            r ->
                new RegionSummary(
                    r.getId(),
                    r.getCode() != null ? r.getCode() : "",
                    r.getName() != null ? r.getName() : ""))
        .toList();
  }
}
