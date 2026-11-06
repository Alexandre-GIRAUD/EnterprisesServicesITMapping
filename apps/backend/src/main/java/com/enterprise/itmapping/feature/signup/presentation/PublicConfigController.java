package com.enterprise.itmapping.feature.signup.presentation;

import com.enterprise.itmapping.feature.signup.application.SignupProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** What the signed-out UI needs to know about this install. Public. */
@RestController
public class PublicConfigController {

  private final SignupProperties signupProperties;
  private final boolean isMailEnabled;

  public PublicConfigController(
      SignupProperties signupProperties, @Value("${spring.mail.host:}") String smtpHost) {
    this.signupProperties = signupProperties;
    this.isMailEnabled = StringUtils.hasText(smtpHost);
  }

  @GetMapping("/config")
  public PublicConfigResponse getPublicConfig() {
    return new PublicConfigResponse(signupProperties.enabled(), isMailEnabled);
  }

  /** {@code mailEnabled}: invitations and password resets can be emailed. */
  public record PublicConfigResponse(boolean signupEnabled, boolean mailEnabled) {}
}
