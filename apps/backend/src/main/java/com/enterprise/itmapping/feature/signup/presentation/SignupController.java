package com.enterprise.itmapping.feature.signup.presentation;

import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.signup.application.EmailVerificationService;
import com.enterprise.itmapping.feature.signup.application.SignupProperties;
import com.enterprise.itmapping.feature.signup.application.SignupService;
import com.enterprise.itmapping.feature.signup.presentation.dto.ResendVerificationRequest;
import com.enterprise.itmapping.feature.signup.presentation.dto.SignupRequest;
import com.enterprise.itmapping.feature.signup.presentation.dto.SignupResponse;
import com.enterprise.itmapping.feature.signup.presentation.dto.VerifyEmailRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Public self-service signup. Answers 404 unless {@code APP_SIGNUP_ENABLED} is on. */
@RestController
@RequestMapping("/auth")
public class SignupController {

  private final SignupProperties signupProperties;
  private final SignupService signupService;
  private final EmailVerificationService emailVerificationService;

  public SignupController(
      SignupProperties signupProperties,
      SignupService signupService,
      EmailVerificationService emailVerificationService) {
    this.signupProperties = signupProperties;
    this.signupService = signupService;
    this.emailVerificationService = emailVerificationService;
  }

  @PostMapping("/signup")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public SignupResponse signUp(
      @Valid @RequestBody SignupRequest request, HttpServletRequest httpRequest) {
    requireSignupEnabled();
    return new SignupResponse(signupService.signUp(request, httpRequest.getRemoteAddr()));
  }

  @PostMapping("/verify-email")
  public LoginResponse verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
    requireSignupEnabled();
    return emailVerificationService.verify(request.token());
  }

  @PostMapping("/resend-verification")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public void resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
    requireSignupEnabled();
    emailVerificationService.resend(request.email());
  }

  private void requireSignupEnabled() {
    if (!signupProperties.enabled()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
  }
}
