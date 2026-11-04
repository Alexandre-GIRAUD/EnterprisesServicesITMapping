package com.enterprise.itmapping.feature.breach.presentation;

import com.enterprise.itmapping.feature.breach.application.BreachImpactService;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachImpactResponse;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Breach impact of a pending Change item, next to the Change endpoints. */
@RestController
public class BreachImpactController {

  private final BreachImpactService breachImpactService;

  public BreachImpactController(BreachImpactService breachImpactService) {
    this.breachImpactService = breachImpactService;
  }

  @GetMapping("/change-detections/{runId}/items/{itemId}/breach-impact")
  public BreachImpactResponse impact(@PathVariable UUID runId, @PathVariable UUID itemId) {
    return breachImpactService.impact(runId, itemId);
  }
}
