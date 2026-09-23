package com.enterprise.itmapping.feature.attributeaudit.presentation;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeOverrideConflictService;
import com.enterprise.itmapping.feature.attributeaudit.domain.OverrideConflictStatus;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeOverrideConflictPageResponse;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeOverrideConflictResponse;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/override-conflicts")
public class AttributeOverrideConflictController {

  private final AttributeOverrideConflictService conflictService;

  public AttributeOverrideConflictController(AttributeOverrideConflictService conflictService) {
    this.conflictService = conflictService;
  }

  @GetMapping
  public AttributeOverrideConflictPageResponse list(
      @RequestParam(required = false) OverrideConflictStatus status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return conflictService.list(status, page, size);
  }

  @GetMapping("/pending-count")
  public Map<String, Long> pendingCount() {
    return Map.of("count", conflictService.countPending());
  }

  @GetMapping("/{id}")
  public AttributeOverrideConflictResponse get(@PathVariable UUID id) {
    return conflictService.get(id);
  }

  @PostMapping("/{id}/accept")
  public AttributeOverrideConflictResponse accept(@PathVariable UUID id) {
    return conflictService.accept(id);
  }

  @PostMapping("/{id}/reject")
  public AttributeOverrideConflictResponse reject(@PathVariable UUID id) {
    return conflictService.reject(id);
  }
}
