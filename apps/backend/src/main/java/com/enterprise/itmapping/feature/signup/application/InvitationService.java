package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.application.AuthService;
import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.domain.UserRole;
import com.enterprise.itmapping.feature.auth.domain.UserStatus;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.signup.domain.InvitationStatus;
import com.enterprise.itmapping.feature.signup.infrastructure.persistence.InvitationEntity;
import com.enterprise.itmapping.feature.signup.infrastructure.persistence.InvitationRepository;
import com.enterprise.itmapping.feature.signup.presentation.dto.InvitationResponse;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Admins invite people into their workspace; an invitee accepts by choosing a password. */
@Service
public class InvitationService {

  private static final String ACCEPT_PATH = "/accept-invitation";
  private static final int INVITATIONS_PER_WORKSPACE_PER_HOUR = 20;

  private final InvitationRepository invitations;
  private final UserRepository userRepository;
  private final WorkspaceRepository workspaceRepository;
  private final CurrentUserResolver currentUserResolver;
  private final AccountMailer mailer;
  private final AccountLinks accountLinks;
  private final PasswordEncoder passwordEncoder;
  private final AuthService authService;
  private final Clock clock;
  private final SlidingWindowLimiter invitationsPerWorkspace;

  public InvitationService(
      InvitationRepository invitations,
      UserRepository userRepository,
      WorkspaceRepository workspaceRepository,
      CurrentUserResolver currentUserResolver,
      AccountMailer mailer,
      AccountLinks accountLinks,
      PasswordEncoder passwordEncoder,
      AuthService authService,
      Clock clock) {
    this.invitations = invitations;
    this.userRepository = userRepository;
    this.workspaceRepository = workspaceRepository;
    this.currentUserResolver = currentUserResolver;
    this.mailer = mailer;
    this.accountLinks = accountLinks;
    this.passwordEncoder = passwordEncoder;
    this.authService = authService;
    this.clock = clock;
    this.invitationsPerWorkspace =
        SlidingWindowLimiter.perHour(INVITATIONS_PER_WORKSPACE_PER_HOUR, clock);
  }

  @Transactional(readOnly = true)
  public List<InvitationResponse> listPending() {
    Instant now = clock.instant();
    return invitations
        .findAllByWorkspaceIdAndAcceptedAtIsNullOrderByCreatedAtDesc(CurrentWorkspace.requireId())
        .stream()
        .map(invitation -> toResponse(invitation, now))
        .toList();
  }

  @Transactional
  public InvitationResponse invite(String rawEmail, UserRole role) {
    UUID workspaceId = CurrentWorkspace.requireId();
    String email = SignupService.normalizeEmail(rawEmail);
    if (userRepository.existsByEmailIgnoreCase(email)
        || userRepository.existsByUsernameIgnoreCase(email)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "This email already has a Flowra account.");
    }
    if (invitations.existsByWorkspaceIdAndEmailIgnoreCaseAndAcceptedAtIsNull(workspaceId, email)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "This email is already invited. Resend the invitation instead.");
    }
    requireInvitationBudget(workspaceId);
    UUID inviter = currentUserResolver.requireCurrentUser().getId();
    InvitationEntity invitation =
        new InvitationEntity(workspaceId, email, role, inviter, clock.instant());
    sendNewLink(invitation);
    return toResponse(invitations.save(invitation), clock.instant());
  }

  @Transactional
  public void resend(UUID invitationId) {
    InvitationEntity invitation = requirePendingInWorkspace(invitationId);
    requireInvitationBudget(invitation.getWorkspaceId());
    sendNewLink(invitation);
  }

  @Transactional
  public void cancel(UUID invitationId) {
    invitations.delete(requirePendingInWorkspace(invitationId));
  }

  /** Creates the invitee's account in the inviting workspace and signs it in. */
  @Transactional
  public LoginResponse accept(String token, String password) {
    String tokenHash = AccountTokens.hash(token);
    if (invitations.acceptIfOpen(tokenHash, clock.instant()) == 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "This invitation is invalid or has expired. Ask your administrator for a new one.");
    }
    InvitationEntity invitation = invitations.findByTokenHash(tokenHash).orElseThrow();
    if (userRepository.existsByEmailIgnoreCase(invitation.getEmail())) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "This email already has a Flowra account. Sign in instead.");
    }
    UserEntity member = new UserEntity();
    member.setUsername(invitation.getEmail());
    member.setEmail(invitation.getEmail());
    member.setPasswordHash(passwordEncoder.encode(password));
    member.setRole(invitation.getRole());
    member.setStatus(UserStatus.ACTIVE);
    member.setWorkspaceId(invitation.getWorkspaceId());
    userRepository.save(member);
    return authService.openSession(member);
  }

  private void sendNewLink(InvitationEntity invitation) {
    String token = AccountTokens.newToken();
    invitation.renew(
        AccountTokens.hash(token), clock.instant().plus(AccountEmails.INVITATION_VALIDITY));
    String workspaceName =
        workspaceRepository
            .findById(invitation.getWorkspaceId())
            .map(WorkspaceEntity::getName)
            .orElse("");
    mailer.send(
        invitation.getEmail(),
        AccountEmails.invitation(accountLinks.build(ACCEPT_PATH, token), workspaceName));
  }

  private void requireInvitationBudget(UUID workspaceId) {
    if (!invitationsPerWorkspace.tryAcquire(workspaceId.toString())) {
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "Too many invitations this hour. Try again later.");
    }
  }

  private InvitationEntity requirePendingInWorkspace(UUID invitationId) {
    return invitations
        .findByIdAndWorkspaceIdAndAcceptedAtIsNull(invitationId, CurrentWorkspace.requireId())
        .orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found."));
  }

  private static InvitationResponse toResponse(InvitationEntity invitation, Instant now) {
    InvitationStatus status =
        invitation.isExpiredAt(now) ? InvitationStatus.EXPIRED : InvitationStatus.INVITED;
    return new InvitationResponse(
        invitation.getId(),
        invitation.getEmail(),
        invitation.getRole(),
        status,
        invitation.getExpiresAt());
  }
}
