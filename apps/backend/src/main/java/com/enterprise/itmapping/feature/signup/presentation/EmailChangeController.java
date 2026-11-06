package com.enterprise.itmapping.feature.signup.presentation;

import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.signup.application.ConditionalOnMailEnabled;
import com.enterprise.itmapping.feature.signup.application.EmailChangeService;
import com.enterprise.itmapping.feature.signup.presentation.dto.ChangeEmailRequest;
import com.enterprise.itmapping.feature.signup.presentation.dto.ConfirmEmailChangeRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Changing the account email. The request needs a signed-in user; the confirmation is public, as
 * the link may open in another browser. Only exists when mail can be sent.
 */
@RestController
@ConditionalOnMailEnabled
public class EmailChangeController {

  private final EmailChangeService emailChangeService;

  public EmailChangeController(EmailChangeService emailChangeService) {
    this.emailChangeService = emailChangeService;
  }

  @PostMapping("/account/email")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public void requestChange(@Valid @RequestBody ChangeEmailRequest request) {
    emailChangeService.requestChange(request.email());
  }

  @PostMapping("/auth/confirm-email-change")
  public LoginResponse confirm(@Valid @RequestBody ConfirmEmailChangeRequest request) {
    return emailChangeService.confirm(request.token());
  }
}
