package com.enterprise.itmapping.feature.auth.presentation;

import com.enterprise.itmapping.feature.auth.application.EmailNotVerifiedException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Gives the sign-in page a stable code to show the "check your inbox" state. */
@RestControllerAdvice
public class EmailNotVerifiedHandler {

  private static final String CODE = "EMAIL_NOT_VERIFIED";

  @ExceptionHandler(EmailNotVerifiedException.class)
  @ResponseStatus(HttpStatus.FORBIDDEN)
  public EmailNotVerifiedBody handleEmailNotVerified(EmailNotVerifiedException exception) {
    return new EmailNotVerifiedBody(CODE, exception.getMessage());
  }

  public record EmailNotVerifiedBody(String code, String message) {}
}
