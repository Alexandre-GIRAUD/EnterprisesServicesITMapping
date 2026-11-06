package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.application.AuthService;
import com.enterprise.itmapping.feature.auth.domain.UserStatus;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.signup.domain.TokenPurpose;
import com.enterprise.itmapping.feature.signup.infrastructure.persistence.AccountTokenEntity;
import java.time.Clock;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Mails a password reset link, and replaces the password when the link comes back. */
@Service
public class PasswordResetService {

  private static final String RESET_PATH = "/reset-password";
  private static final int REQUESTS_PER_EMAIL_PER_HOUR = 3;

  private final UserRepository userRepository;
  private final AccountTokens tokens;
  private final AccountMailer mailer;
  private final AccountLinks accountLinks;
  private final PasswordEncoder passwordEncoder;
  private final AuthService authService;
  private final SlidingWindowLimiter requestsPerEmail;

  public PasswordResetService(
      UserRepository userRepository,
      AccountTokens tokens,
      AccountMailer mailer,
      AccountLinks accountLinks,
      PasswordEncoder passwordEncoder,
      AuthService authService,
      Clock clock) {
    this.userRepository = userRepository;
    this.tokens = tokens;
    this.mailer = mailer;
    this.accountLinks = accountLinks;
    this.passwordEncoder = passwordEncoder;
    this.authService = authService;
    this.requestsPerEmail = SlidingWindowLimiter.perHour(REQUESTS_PER_EMAIL_PER_HOUR, clock);
  }

  /** Mails a link to an active account with this email. Silent otherwise: emails cannot be probed. */
  @Transactional
  public void requestReset(String rawEmail) {
    String email = SignupService.normalizeEmail(rawEmail);
    if (!requestsPerEmail.tryAcquire(email)) {
      return;
    }
    userRepository
        .findByEmailIgnoreCase(email)
        .filter(user -> user.getStatus() == UserStatus.ACTIVE)
        .ifPresent(this::sendResetLink);
  }

  /** Sets the new password of the link's account and signs it in. */
  @Transactional
  public LoginResponse resetPassword(String token, String newPassword) {
    UserEntity user =
        tokens
            .redeem(token, TokenPurpose.RESET_PASSWORD)
            .map(AccountTokenEntity::getUser)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "This link is invalid or has expired. Ask for a new one."));
    user.setPasswordHash(passwordEncoder.encode(newPassword));
    return authService.openSession(user);
  }

  private void sendResetLink(UserEntity user) {
    String token = tokens.issue(user, TokenPurpose.RESET_PASSWORD);
    mailer.send(user.getEmail(), AccountEmails.passwordReset(accountLinks.build(RESET_PATH, token)));
  }
}
