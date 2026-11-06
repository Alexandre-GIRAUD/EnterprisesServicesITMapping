package com.enterprise.itmapping.feature.integrations.github.presentation;

import com.enterprise.itmapping.feature.changedetection.application.ChangeDetectionService;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubWebhookSignatureVerifier;
import com.enterprise.itmapping.feature.integrations.github.application.WorkspaceWebhookSecrets;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import com.enterprise.itmapping.feature.workspace.domain.Workspaces;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(GitHubWebhookController.WEBHOOK_PATH)
public class GitHubWebhookController {

  public static final String WEBHOOK_PATH = "/webhooks/github";

  private static final String SIGNATURE_HEADER = "X-Hub-Signature-256";
  private static final String EVENT_HEADER = "X-GitHub-Event";
  private static final String PUSH_EVENT = "push";
  private static final String PING_EVENT = "ping";

  private final GitHubWebhookSignatureVerifier signatureVerifier;
  private final GitHubIntegrationProperties properties;
  private final ChangeDetectionService changeDetectionService;
  private final WorkspaceWebhookSecrets webhookSecrets;

  public GitHubWebhookController(
      GitHubWebhookSignatureVerifier signatureVerifier,
      GitHubIntegrationProperties properties,
      ChangeDetectionService changeDetectionService,
      WorkspaceWebhookSecrets webhookSecrets) {
    this.signatureVerifier = signatureVerifier;
    this.properties = properties;
    this.changeDetectionService = changeDetectionService;
    this.webhookSecrets = webhookSecrets;
  }

  /**
   * A workspace's own URL, signed with that workspace's secret. An unknown workspace is refused
   * like a bad signature, so the answer does not tell which workspace ids exist.
   */
  @PostMapping("/{workspaceId}")
  public ResponseEntity<Map<String, Object>> pushToWorkspace(
      @PathVariable UUID workspaceId,
      @RequestHeader(value = SIGNATURE_HEADER, required = false) String signature,
      @RequestHeader(value = EVENT_HEADER, required = false) String event,
      @RequestBody byte[] rawBody) {
    String secret =
        webhookSecrets
            .findSecretFor(workspaceId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid webhook signature."));
    return receive(workspaceId, secret, new Delivery(signature, event, rawBody));
  }

  /**
   * The URL from before workspace webhooks: serves the Default workspace only, and only while
   * GITHUB_WEBHOOK_SECRET is set, so existing installations keep working after the upgrade.
   */
  @PostMapping
  public ResponseEntity<Map<String, Object>> pushToDefaultWorkspace(
      @RequestHeader(value = SIGNATURE_HEADER, required = false) String signature,
      @RequestHeader(value = EVENT_HEADER, required = false) String event,
      @RequestBody byte[] rawBody) {
    if (!StringUtils.hasText(properties.webhookSecret())) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND,
          "This webhook URL is retired: use the workspace webhook URL shown in Settings.");
    }
    return receive(
        Workspaces.DEFAULT_ID,
        properties.webhookSecret(),
        new Delivery(signature, event, rawBody));
  }

  private ResponseEntity<Map<String, Object>> receive(
      UUID workspaceId, String secret, Delivery delivery) {
    signatureVerifier.verify(secret, delivery.signature(), delivery.rawBody());
    String event = delivery.event();
    if (event != null && !PUSH_EVENT.equalsIgnoreCase(event) && !PING_EVENT.equalsIgnoreCase(event)) {
      return ResponseEntity.accepted().body(Map.of("ignored", true, "event", event));
    }
    if (PING_EVENT.equalsIgnoreCase(event)) {
      return ResponseEntity.ok(Map.of("ok", true, "event", PING_EVENT));
    }
    List<UUID> runIds = new ArrayList<>();
    CurrentWorkspace.runAs(
        workspaceId,
        () -> runIds.addAll(changeDetectionService.ingestPushWebhook(delivery.rawBody())));
    return ResponseEntity.accepted().body(Map.of("accepted", true, "runIds", runIds));
  }

  /** One GitHub delivery as received. */
  private record Delivery(String signature, String event, byte[] rawBody) {}
}
