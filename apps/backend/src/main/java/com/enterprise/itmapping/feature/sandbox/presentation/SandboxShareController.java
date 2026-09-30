package com.enterprise.itmapping.feature.sandbox.presentation;

import com.enterprise.itmapping.feature.sandbox.application.SandboxShareService;
import com.enterprise.itmapping.feature.sandbox.presentation.dto.CreateSandboxShareRequest;
import com.enterprise.itmapping.feature.sandbox.presentation.dto.SandboxShareResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users/me/sandbox-shares")
public class SandboxShareController {

  private final SandboxShareService sandboxShareService;

  public SandboxShareController(SandboxShareService sandboxShareService) {
    this.sandboxShareService = sandboxShareService;
  }

  @GetMapping
  public List<SandboxShareResponse> list() {
    return sandboxShareService.listForCurrentUser();
  }

  @PostMapping
  public ResponseEntity<Void> share(@Valid @RequestBody CreateSandboxShareRequest request) {
    sandboxShareService.share(request.username(), request.name(), request.document());
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    sandboxShareService.deleteForCurrentUser(id);
    return ResponseEntity.noContent().build();
  }
}
