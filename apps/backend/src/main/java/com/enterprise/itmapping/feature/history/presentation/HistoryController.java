package com.enterprise.itmapping.feature.history.presentation;

import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.presentation.dto.AttributeChangePageResponse;
import com.enterprise.itmapping.feature.history.application.SystemStateCaptureService;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/history")
public class HistoryController {

  private final AttributeChangeAuditService auditService;
  private final SystemStateCaptureService captureService;
  private final Clock clock;

  public HistoryController(
      AttributeChangeAuditService auditService,
      SystemStateCaptureService captureService,
      Clock clock) {
    this.auditService = auditService;
    this.captureService = captureService;
    this.clock = clock;
  }

  /** Changes to one application, its modules and its flows, newest first. Days are inclusive. */
  @GetMapping
  public AttributeChangePageResponse forApplication(
      @RequestParam String applicationId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "" + AttributeChangeAuditService.DEFAULT_PAGE_SIZE) int size) {
    return auditService.listForApplication(applicationId, from, to, page, size);
  }

  /** Days that can be viewed with {@code asOf}. */
  @GetMapping("/range")
  public HistoryRangeResponse range() {
    LocalDate today = LocalDate.now(clock);
    return new HistoryRangeResponse(captureService.firstDay().orElse(today), today);
  }

  public record HistoryRangeResponse(LocalDate firstDay, LocalDate today) {}
}
