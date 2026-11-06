package com.enterprise.itmapping.feature.signup.presentation;

import com.enterprise.itmapping.feature.signup.application.SignupProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** What the signed-out UI needs to know about this install. Public. */
@RestController
public class PublicConfigController {

  private final SignupProperties signupProperties;

  public PublicConfigController(SignupProperties signupProperties) {
    this.signupProperties = signupProperties;
  }

  @GetMapping("/config")
  public PublicConfigResponse config() {
    return new PublicConfigResponse(signupProperties.enabled());
  }

  public record PublicConfigResponse(boolean signupEnabled) {}
}
