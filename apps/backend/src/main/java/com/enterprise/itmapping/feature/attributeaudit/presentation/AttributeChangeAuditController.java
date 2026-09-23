package com.enterprise.itmapping.feature.attributeaudit.presentation;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.domain.AuditTargetType;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangePageResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/audit/attributes")
public class AttributeChangeAuditController {

  private final AttributeChangeAuditService auditService;

  public AttributeChangeAuditController(AttributeChangeAuditService auditService) {
    this.auditService = auditService;
  }

  @GetMapping
  public AttributeChangePageResponse list(
      @RequestParam AuditTargetType targetType,
      @RequestParam String targetId,
      @RequestParam(required = false) String fieldKey,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return auditService.list(targetType, targetId, fieldKey, page, size);
  }
}
