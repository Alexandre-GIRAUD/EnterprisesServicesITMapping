package com.enterprise.itmapping.feature.signup.presentation;

import com.enterprise.itmapping.feature.signup.application.ConditionalOnMailEnabled;
import com.enterprise.itmapping.feature.signup.application.InvitationService;
import com.enterprise.itmapping.feature.signup.presentation.dto.InvitationResponse;
import com.enterprise.itmapping.feature.signup.presentation.dto.InviteRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The admin's invitations into their workspace. Only exists when mail can be sent. */
@RestController
@RequestMapping("/admin/invitations")
@PreAuthorize("hasRole('ADMIN')")
@ConditionalOnMailEnabled
public class AdminInvitationController {

  private final InvitationService invitationService;

  public AdminInvitationController(InvitationService invitationService) {
    this.invitationService = invitationService;
  }

  @GetMapping
  public List<InvitationResponse> listPending() {
    return invitationService.listPending();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public InvitationResponse invite(@Valid @RequestBody InviteRequest request) {
    return invitationService.invite(request.email(), request.role());
  }

  @PostMapping("/{id}/resend")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void resend(@PathVariable UUID id) {
    invitationService.resend(id);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void cancel(@PathVariable UUID id) {
    invitationService.cancel(id);
  }
}
