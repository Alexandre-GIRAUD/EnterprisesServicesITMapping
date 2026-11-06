package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.application.AuthService;
import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.signup.domain.TokenPurpose;
import com.enterprise.itmapping.feature.signup.infrastructure.persistence.AccountTokenEntity;
import java.time.Clock;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Moves an account to a new email address once that address confirms. An account whose username
 * was its email signs in with the new address; an older account keeps its username.
 */
@Service
public class EmailChangeService {

  private static final String CONFIRM_PATH = "/confirm-email";
  private static final int REQUESTS_PER_USER_PER_HOUR = 3;

  private final CurrentUserResolver currentUserResolver;
  private final UserRepository userRepository;
  private final AccountTokens tokens;
  private final AccountMailer mailer;
  private final AccountLinks accountLinks;
  private final AuthService authService;
  private final SlidingWindowLimiter requestsPerUser;

  public EmailChangeService(
      CurrentUserResolver currentUserResolver,
      UserRepository userRepository,
      AccountTokens tokens,
      AccountMailer mailer,
      AccountLinks accountLinks,
      AuthService authService,
      Clock clock) {
    this.currentUserResolver = currentUserResolver;
    this.userRepository = userRepository;
    this.tokens = tokens;
    this.mailer = mailer;
    this.accountLinks = accountLinks;
    this.authService = authService;
    this.requestsPerUser = SlidingWindowLimiter.perHour(REQUESTS_PER_USER_PER_HOUR, clock);
  }

  /** Mails a confirmation link to {@code rawEmail}; the account changes only when it is clicked. */
  @Transactional
  public void requestChange(String rawEmail) {
    UserEntity user = currentUserResolver.requireCurrentUser();
    String newEmail = SignupService.normalizeEmail(rawEmail);
    requireAvailable(user, newEmail);
    if (!requestsPerUser.tryAcquire(user.getId().toString())) {
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "Too many email changes this hour. Try again later.");
    }
    String token = tokens.issue(user, TokenPurpose.CHANGE_EMAIL, newEmail);
    mailer.send(newEmail, AccountEmails.emailChange(accountLinks.build(CONFIRM_PATH, token)));
  }

  /** Applies the confirmed address and signs the account in under its possibly new username. */
  @Transactional
  public LoginResponse confirm(String token) {
    AccountTokenEntity confirmation =
        tokens
            .redeem(token, TokenPurpose.CHANGE_EMAIL)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "This link is invalid or has expired. Ask for a new one in Settings."));
    UserEntity user = confirmation.getUser();
    String newEmail = confirmation.getNewEmail();
    requireAvailable(user, newEmail);
    boolean isUsernameTheEmail = user.getUsername().equalsIgnoreCase(user.getEmail());
    if (isUsernameTheEmail) {
      user.setUsername(newEmail);
    }
    user.setEmail(newEmail);
    return authService.openSession(user);
  }

  private void requireAvailable(UserEntity user, String email) {
    boolean isTakenByEmail =
        userRepository
            .findByEmailIgnoreCase(email)
            .filter(owner -> !owner.getId().equals(user.getId()))
            .isPresent();
    boolean isTakenByUsername =
        userRepository
            .findByUsernameIgnoreCase(email)
            .filter(owner -> !owner.getId().equals(user.getId()))
            .isPresent();
    if (isTakenByEmail || isTakenByUsername) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Another Flowra account already uses this email.");
    }
  }
}
