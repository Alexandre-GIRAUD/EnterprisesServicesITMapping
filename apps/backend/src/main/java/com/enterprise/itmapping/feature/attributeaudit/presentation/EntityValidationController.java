package com.enterprise.itmapping.feature.attributeaudit.presentation;

import com.enterprise.itmapping.feature.attributeaudit.application.EntityValidationService;
import com.enterprise.itmapping.feature.attributeaudit.application.EntityValidationService.Stamp;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/audit/validations")
public class EntityValidationController {

  private final EntityValidationService validationService;

  public EntityValidationController(EntityValidationService validationService) {
    this.validationService = validationService;
  }

  @GetMapping
  public ResponseEntity<Stamp> find(
      @RequestParam AuditTargetType targetType, @RequestParam String targetId) {
    return validationService
        .find(targetType, targetId)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
  }

  @PostMapping
  public Stamp confirm(@RequestBody ConfirmRequest request) {
    return validationService.confirm(request.targetType(), request.targetId());
  }

  public record ConfirmRequest(AuditTargetType targetType, String targetId) {}
}
