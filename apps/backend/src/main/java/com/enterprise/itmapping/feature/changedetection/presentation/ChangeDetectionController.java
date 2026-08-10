package com.enterprise.itmapping.feature.changedetection.presentation;

import com.enterprise.itmapping.feature.changedetection.application.ChangeDetectionService;
import com.enterprise.itmapping.feature.changedetection.presentation.dto.ChangeDetectionItemDto;
import com.enterprise.itmapping.feature.changedetection.presentation.dto.ChangeDetectionRunDto;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/change-detections")
public class ChangeDetectionController {

  private final ChangeDetectionService changeDetectionService;

  public ChangeDetectionController(ChangeDetectionService changeDetectionService) {
    this.changeDetectionService = changeDetectionService;
  }

  @GetMapping
  public List<ChangeDetectionRunDto> list(
      @RequestParam(required = false) String applicationId,
      @RequestParam(required = false) String status) {
    return changeDetectionService.list(applicationId, status);
  }

  @GetMapping("/{id}")
  public ChangeDetectionRunDto get(@PathVariable UUID id) {
    return changeDetectionService.get(id);
  }

  @PostMapping("/{runId}/items/{itemId}/accept")
  public ChangeDetectionItemDto accept(@PathVariable UUID runId, @PathVariable UUID itemId) {
    return changeDetectionService.acceptItem(runId, itemId);
  }

  @PostMapping("/{runId}/items/{itemId}/reject")
  public ChangeDetectionItemDto reject(@PathVariable UUID runId, @PathVariable UUID itemId) {
    return changeDetectionService.rejectItem(runId, itemId);
  }
}
