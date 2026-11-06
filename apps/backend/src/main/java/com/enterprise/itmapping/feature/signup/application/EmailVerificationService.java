package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.application.AuthService;
import com.enterprise.itmapping.feature.auth.domain.UserStatus;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import java.time.Clock;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Confirms an email from its link, or sends the link again. */
@Service
public class EmailVerificationService {

  private static final int RESENDS_PER_EMAIL_PER_HOUR = 3;

  private final VerificationTokens tokens;
  private final VerificationLinks verificationLinks;
  private final UserRepository userRepository;
  private final AuthService authService;
  private final SlidingWindowLimiter resendsPerEmail;

  public EmailVerificationService(
      VerificationTokens tokens,
      VerificationLinks verificationLinks,
      UserRepository userRepository,
      AuthService authService,
      Clock clock) {
    this.tokens = tokens;
    this.verificationLinks = verificationLinks;
    this.userRepository = userRepository;
    this.authService = authService;
    this.resendsPerEmail =
        new SlidingWindowLimiter(RESENDS_PER_EMAIL_PER_HOUR, Duration.ofHours(1), clock);
  }

  /** Activates the account behind {@code token} and signs it in. */
  @Transactional
  public LoginResponse verify(String token) {
    UserEntity user =
        tokens
            .redeem(token)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "This link is invalid or has expired. Ask for a new one."));
    user.setStatus(UserStatus.ACTIVE);
    return authService.openSession(user);
  }

  /** Sends a new link to a pending account. Silent otherwise, so emails cannot be probed. */
  @Transactional
  public void resend(String rawEmail) {
    String email = SignupService.normalizeEmail(rawEmail);
    if (!resendsPerEmail.tryAcquire(email)) {
      return;
    }
    userRepository
        .findByEmailIgnoreCase(email)
        .filter(user -> user.getStatus() == UserStatus.PENDING)
        .ifPresent(verificationLinks::send);
  }
}
