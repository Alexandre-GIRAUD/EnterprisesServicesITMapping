package com.enterprise.itmapping.feature.signup.presentation;

import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.signup.application.EmailVerificationService;
import com.enterprise.itmapping.feature.signup.application.SignupService;
import com.enterprise.itmapping.feature.signup.presentation.dto.ResendVerificationRequest;
import com.enterprise.itmapping.feature.signup.presentation.dto.SignupRequest;
import com.enterprise.itmapping.feature.signup.presentation.dto.SignupResponse;
import com.enterprise.itmapping.feature.signup.presentation.dto.VerifyEmailRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public self-service signup. Registered only when {@code APP_SIGNUP_ENABLED} is on, so the routes
 * answer 404 otherwise, before any request validation.
 */
@RestController
@ConditionalOnProperty(prefix = "app.signup", name = "enabled", havingValue = "true")
@RequestMapping("/auth")
public class SignupController {

  private final SignupService signupService;
  private final EmailVerificationService emailVerificationService;

  public SignupController(
      SignupService signupService, EmailVerificationService emailVerificationService) {
    this.signupService = signupService;
    this.emailVerificationService = emailVerificationService;
  }

  @PostMapping("/signup")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public SignupResponse signUp(
      @Valid @RequestBody SignupRequest request, HttpServletRequest httpRequest) {
    return new SignupResponse(signupService.signUp(request, httpRequest.getRemoteAddr()));
  }

  @PostMapping("/verify-email")
  public LoginResponse verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
    return emailVerificationService.verify(request.token());
  }

  @PostMapping("/resend-verification")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public void resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
    emailVerificationService.resend(request.email());
  }
}
