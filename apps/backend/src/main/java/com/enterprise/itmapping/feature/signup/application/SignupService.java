package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.domain.UserRole;
import com.enterprise.itmapping.feature.auth.domain.UserStatus;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.signup.presentation.dto.SignupRequest;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceRepository;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Creates a workspace and its pending admin, then mails the verification link. */
@Service
public class SignupService {

  private static final int SIGNUPS_PER_ADDRESS_PER_HOUR = 5;

  private final UserRepository userRepository;
  private final WorkspaceRepository workspaceRepository;
  private final PasswordEncoder passwordEncoder;
  private final VerificationLinks verificationLinks;
  private final SlidingWindowLimiter signupsPerAddress;

  public SignupService(
      UserRepository userRepository,
      WorkspaceRepository workspaceRepository,
      PasswordEncoder passwordEncoder,
      VerificationLinks verificationLinks,
      Clock clock) {
    this.userRepository = userRepository;
    this.workspaceRepository = workspaceRepository;
    this.passwordEncoder = passwordEncoder;
    this.verificationLinks = verificationLinks;
    this.signupsPerAddress =
        new SlidingWindowLimiter(SIGNUPS_PER_ADDRESS_PER_HOUR, Duration.ofHours(1), clock);
  }

  /** @return the normalized email the link was sent to */
  @Transactional
  public String signUp(SignupRequest request, String clientAddress) {
    if (!signupsPerAddress.tryAcquire(clientAddress)) {
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "Too many signups from this address. Try again in an hour.");
    }
    String email = normalizeEmail(request.email());
    if (userRepository.existsByEmailIgnoreCase(email)
        || userRepository.existsByUsernameIgnoreCase(email)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "An account already uses this email. Sign in instead.");
    }
    WorkspaceEntity workspace =
        workspaceRepository.save(
            new WorkspaceEntity(UUID.randomUUID(), request.workspaceName().trim()));
    UserEntity admin = new UserEntity();
    admin.setUsername(email);
    admin.setEmail(email);
    admin.setPasswordHash(passwordEncoder.encode(request.password()));
    admin.setRole(UserRole.ADMIN);
    admin.setStatus(UserStatus.PENDING);
    admin.setWorkspaceId(workspace.getId());
    userRepository.save(admin);
    verificationLinks.send(admin);
    return email;
  }

  static String normalizeEmail(String raw) {
    return raw.trim().toLowerCase(Locale.ROOT);
  }
}
