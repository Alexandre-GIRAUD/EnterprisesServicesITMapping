package com.enterprise.itmapping.feature.signup.presentation;

import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.signup.application.ConditionalOnMailEnabled;
import com.enterprise.itmapping.feature.signup.application.InvitationService;
import com.enterprise.itmapping.feature.signup.presentation.dto.AcceptInvitationRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public: the invitee is not signed in yet. Only exists when mail can be sent. */
@RestController
@RequestMapping("/auth")
@ConditionalOnMailEnabled
public class InvitationAcceptanceController {

  private final InvitationService invitationService;

  public InvitationAcceptanceController(InvitationService invitationService) {
    this.invitationService = invitationService;
  }

  @PostMapping("/accept-invitation")
  public LoginResponse accept(@Valid @RequestBody AcceptInvitationRequest request) {
    return invitationService.accept(request.token(), request.password());
  }
}
