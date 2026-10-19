package com.enterprise.itmapping.feature.table.presentation;

import com.enterprise.itmapping.feature.table.application.CustomTableShareService;
import com.enterprise.itmapping.feature.table.presentation.dto.CreateCustomTableShareRequest;
import com.enterprise.itmapping.feature.table.presentation.dto.CustomTableShareResponse;
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
@RequestMapping("/users/me/custom-table-shares")
public class CustomTableShareController {

  private final CustomTableShareService customTableShareService;

  public CustomTableShareController(CustomTableShareService customTableShareService) {
    this.customTableShareService = customTableShareService;
  }

  @GetMapping
  public List<CustomTableShareResponse> list() {
    return customTableShareService.listForCurrentUser();
  }

  @PostMapping
  public ResponseEntity<Void> share(@Valid @RequestBody CreateCustomTableShareRequest request) {
    customTableShareService.share(request.username(), request.name(), request.document());
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    customTableShareService.deleteForCurrentUser(id);
    return ResponseEntity.noContent().build();
  }
}
