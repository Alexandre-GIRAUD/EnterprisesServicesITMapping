package com.enterprise.itmapping.feature.auth.application;

/** Correct credentials of an account whose email is not confirmed yet. */
public class EmailNotVerifiedException extends RuntimeException {

  public EmailNotVerifiedException() {
    super("Confirm your email address before signing in.");
  }
}
