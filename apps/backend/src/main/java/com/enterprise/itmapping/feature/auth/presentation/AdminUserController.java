package com.enterprise.itmapping.feature.auth.presentation;

import com.enterprise.itmapping.feature.auth.application.UserAdminService;
import com.enterprise.itmapping.feature.auth.presentation.dto.CreateUserRequest;
import com.enterprise.itmapping.feature.auth.presentation.dto.UserSummaryResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

  private final UserAdminService userAdminService;

  public AdminUserController(UserAdminService userAdminService) {
    this.userAdminService = userAdminService;
  }

  @PostMapping
  public ResponseEntity<UserSummaryResponse> create(@Valid @RequestBody CreateUserRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(userAdminService.createUser(request));
  }

  @GetMapping
  public List<UserSummaryResponse> list() {
    return userAdminService.listUsers();
  }
}
