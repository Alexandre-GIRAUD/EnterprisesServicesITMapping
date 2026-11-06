package com.enterprise.itmapping.feature.integrations.github.presentation;

import com.enterprise.itmapping.feature.changedetection.application.ChangeDetectionService;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubWebhookSignatureVerifier;
import com.enterprise.itmapping.feature.workspace.application.EveryWorkspace;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/webhooks/github")
public class GitHubWebhookController {

  private final GitHubWebhookSignatureVerifier signatureVerifier;
  private final GitHubIntegrationProperties properties;
  private final ChangeDetectionService changeDetectionService;
  private final EveryWorkspace everyWorkspace;

  public GitHubWebhookController(
      GitHubWebhookSignatureVerifier signatureVerifier,
      GitHubIntegrationProperties properties,
      ChangeDetectionService changeDetectionService,
      EveryWorkspace everyWorkspace) {
    this.signatureVerifier = signatureVerifier;
    this.properties = properties;
    this.changeDetectionService = changeDetectionService;
    this.everyWorkspace = everyWorkspace;
  }

  @PostMapping
  public ResponseEntity<Map<String, Object>> push(
      @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
      @RequestHeader(value = "X-GitHub-Event", required = false) String event,
      @RequestBody byte[] rawBody) {
    signatureVerifier.verify(properties.webhookSecret(), signature, rawBody);
    if (event != null && !"push".equalsIgnoreCase(event) && !"ping".equalsIgnoreCase(event)) {
      return ResponseEntity.accepted().body(Map.of("ignored", true, "event", event));
    }
    if ("ping".equalsIgnoreCase(event)) {
      return ResponseEntity.ok(Map.of("ok", true, "event", "ping"));
    }
    // A push names a repository, not a workspace: each workspace linking that repository gets a run.
    List<UUID> runIds = new ArrayList<>();
    everyWorkspace.run(() -> runIds.addAll(changeDetectionService.ingestPushWebhook(rawBody)));
    return ResponseEntity.accepted().body(Map.of("accepted", true, "runIds", runIds));
  }
}
