package com.enterprise.itmapping.feature.signup.presentation;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.signup.presentation.dto.AccountResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in account. */
@RestController
public class AccountController {

  private final CurrentUserResolver currentUserResolver;

  public AccountController(CurrentUserResolver currentUserResolver) {
    this.currentUserResolver = currentUserResolver;
  }

  @GetMapping("/account")
  public AccountResponse getAccount() {
    UserEntity user = currentUserResolver.requireCurrentUser();
    return new AccountResponse(user.getUsername(), user.getEmail());
  }
}
