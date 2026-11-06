package com.enterprise.itmapping.feature.signup.presentation;

import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.signup.application.ConditionalOnMailEnabled;
import com.enterprise.itmapping.feature.signup.application.PasswordResetService;
import com.enterprise.itmapping.feature.signup.presentation.dto.ForgotPasswordRequest;
import com.enterprise.itmapping.feature.signup.presentation.dto.ResetPasswordRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Public forgot-password flow. Only exists when mail can be sent. */
@RestController
@RequestMapping("/auth")
@ConditionalOnMailEnabled
public class PasswordResetController {

  private final PasswordResetService passwordResetService;

  public PasswordResetController(PasswordResetService passwordResetService) {
    this.passwordResetService = passwordResetService;
  }

  @PostMapping("/forgot-password")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public void requestReset(@Valid @RequestBody ForgotPasswordRequest request) {
    passwordResetService.requestReset(request.email());
  }

  @PostMapping("/reset-password")
  public LoginResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
    return passwordResetService.resetPassword(request.token(), request.password());
  }
}
